import { DatabaseManager } from '../database/connection.js';
import { PromptOrchestrator } from '../services/prompt-orchestrator.js';
import { z } from 'zod';

// Schema for rule update tool arguments
export const ruleUpdateToolSchema = z.object({
  workspace_id: z.string().describe('Workspace ID to update rules for'),
  user_feedback: z.string().describe('User feedback text to analyze for rule extraction'),
  context: z.string().optional().describe('Additional context about the rule source'),
  auto_apply: z.boolean().optional().default(true).describe('Automatically apply detected rules to workspace')
});

interface RuleUpdateToolArgs {
  workspace_id: string;
  user_feedback: string;
  context?: string;
  auto_apply?: boolean;
}

interface DetectedRule {
  trigger_phrase: string;
  rule_type: 'always' | 'never' | 'remember' | 'dont' | 'preference';
  rule_text: string;
  category: string;
  confidence: number;
  original_context: string;
}

export class RuleUpdateTool {
  private db: DatabaseManager;
  private promptOrchestrator: PromptOrchestrator;
  
  // Trigger phrases that indicate user rules
  private triggerPatterns = [
    { pattern: /never\s+(.+)/gi, type: 'never' as const },
    { pattern: /always\s+(.+)/gi, type: 'always' as const },
    { pattern: /remember\s+(.+)/gi, type: 'remember' as const },
    { pattern: /don'?t\s+(.+)/gi, type: 'dont' as const },
    { pattern: /do not\s+(.+)/gi, type: 'dont' as const },
    { pattern: /make sure to\s+(.+)/gi, type: 'always' as const },
    { pattern: /ensure that\s+(.+)/gi, type: 'always' as const },
    { pattern: /avoid\s+(.+)/gi, type: 'never' as const },
    { pattern: /prefer\s+(.+)/gi, type: 'preference' as const },
    { pattern: /use\s+(.+)\s+instead/gi, type: 'preference' as const }
  ];

  constructor(db: DatabaseManager) {
    this.db = db;
    this.promptOrchestrator = new PromptOrchestrator(db);
  }

  /**
   * Get tool definition for MCP server
   */
  static getToolDefinition() {
    return {
      name: 'taskpilot_rule_update',
      description: 'Automatically detect and update workspace rules from user feedback containing trigger phrases like "never", "always", "remember", "don\'t"',
      inputSchema: {
        type: 'object',
        properties: {
          workspace_id: {
            type: 'string',
            description: 'Workspace ID to update rules for'
          },
          user_feedback: {
            type: 'string',
            description: 'User feedback text to analyze for rule extraction (containing phrases like "never do X", "always use Y", "remember to Z")'
          },
          context: {
            type: 'string',
            description: 'Additional context about where the rule originated (e.g., "code review feedback", "project setup")'
          },
          auto_apply: {
            type: 'boolean',
            description: 'Automatically apply detected rules to workspace feedback steps',
            default: true
          }
        },
        required: ['workspace_id', 'user_feedback']
      }
    };
  }

  async execute(args: RuleUpdateToolArgs): Promise<any> {
    try {
      // Validate workspace exists
      const workspace = await this.db.get<any>(
        'SELECT * FROM workspaces WHERE id = ?',
        [args.workspace_id]
      );

      if (!workspace) {
        return {
          content: [{
            type: 'text',
            text: 'Error: Workspace not found'
          }],
          isError: true
        };
      }

      // Detect rules from user feedback
      const detectedRules = this.detectRules(args.user_feedback, args.context);

      let updateResults = {
        rules_detected: detectedRules.length,
        rules_applied: 0,
        rules_skipped: 0,
        workspace_rules_updated: false,
        detected_rules: detectedRules,
        errors: [] as string[]
      };

      if (args.auto_apply && detectedRules.length > 0) {
        updateResults = await this.applyRulesToWorkspace(args.workspace_id, detectedRules);
      }

      // Prepare context for prompt orchestration
      const context = {
        workspace_id: args.workspace_id,
        workspace_name: workspace.name,
        workspace_path: workspace.path,
        user_feedback: args.user_feedback,
        detected_rules: detectedRules,
        update_results: updateResults,
        auto_apply: args.auto_apply,
        timestamp: new Date().toISOString()
      };

      // Get orchestrated prompt response
      const orchestrationResult = await this.promptOrchestrator.orchestratePrompt(
        'taskpilot_rule_update',
        args.workspace_id,
        context
      );

      return {
        content: [{
          type: 'text',
          text: orchestrationResult.prompt_text
        }]
      };
    } catch (error) {
      console.error('Error in taskpilot_rule_update:', error);
      return {
        content: [{
          type: 'text',
          text: `Error updating rules: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      };
    }
  }

  /**
   * Detect rules from user feedback text
   */
  private detectRules(feedback: string, context?: string): DetectedRule[] {
    const detectedRules: DetectedRule[] = [];

    for (const { pattern, type } of this.triggerPatterns) {
      const matches = [...feedback.matchAll(pattern)];
      
      for (const match of matches) {
        if (match[1]) {
          const rule = this.processRuleMatch(match[0], match[1], type, feedback, context);
          if (rule && this.validateRule(rule)) {
            detectedRules.push(rule);
          }
        }
      }
    }

    // Remove duplicates and merge similar rules
    return this.deduplicateRules(detectedRules);
  }

  /**
   * Process a rule match into a structured rule
   */
  private processRuleMatch(
    fullMatch: string, 
    ruleContent: string, 
    type: string, 
    originalText: string,
    context?: string
  ): DetectedRule | null {
    const cleanContent = ruleContent.trim().replace(/[.!?]+$/, '');
    
    if (cleanContent.length < 5 || cleanContent.length > 200) {
      return null; // Too short or too long to be meaningful
    }

    const category = this.categorizeRule(cleanContent);
    const confidence = this.calculateConfidence(fullMatch, cleanContent, originalText);

    return {
      trigger_phrase: fullMatch.trim(),
      rule_type: type as any,
      rule_text: cleanContent,
      category,
      confidence,
      original_context: context || 'user feedback'
    };
  }

  /**
   * Categorize rules by domain
   */
  private categorizeRule(ruleText: string): string {
    const categories = [
      { keywords: ['test', 'testing', 'spec', 'coverage'], category: 'testing' },
      { keywords: ['git', 'commit', 'branch', 'merge', 'pull request'], category: 'git_workflow' },
      { keywords: ['code', 'function', 'variable', 'class', 'method'], category: 'coding_standards' },
      { keywords: ['file', 'directory', 'folder', 'path'], category: 'file_management' },
      { keywords: ['dependency', 'package', 'library', 'import'], category: 'dependencies' },
      { keywords: ['performance', 'optimize', 'cache', 'memory'], category: 'performance' },
      { keywords: ['security', 'auth', 'token', 'password'], category: 'security' },
      { keywords: ['ui', 'interface', 'component', 'style'], category: 'ui_ux' },
      { keywords: ['api', 'endpoint', 'request', 'response'], category: 'api_design' },
      { keywords: ['database', 'query', 'schema', 'migration'], category: 'database' }
    ];

    const lowerRuleText = ruleText.toLowerCase();
    
    for (const { keywords, category } of categories) {
      if (keywords.some(keyword => lowerRuleText.includes(keyword))) {
        return category;
      }
    }

    return 'general';
  }

  /**
   * Calculate confidence score for a rule
   */
  private calculateConfidence(fullMatch: string, ruleContent: string, originalText: string): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence for longer, more specific rules
    if (ruleContent.length > 20) confidence += 0.1;
    if (ruleContent.length > 50) confidence += 0.1;

    // Higher confidence for technical terms
    const technicalTerms = ['function', 'class', 'method', 'variable', 'file', 'test', 'git', 'commit'];
    if (technicalTerms.some(term => ruleContent.toLowerCase().includes(term))) {
      confidence += 0.2;
    }

    // Higher confidence for imperative language
    if (/\b(must|should|need to|required|ensure)\b/i.test(fullMatch)) {
      confidence += 0.1;
    }

    // Lower confidence for very generic rules
    if (/\b(good|bad|better|nice|clean)\b/i.test(ruleContent)) {
      confidence -= 0.1;
    }

    return Math.min(Math.max(confidence, 0.1), 1.0);
  }

  /**
   * Validate if a rule is meaningful and actionable
   */
  private validateRule(rule: DetectedRule): boolean {
    // Skip rules that are too generic or meaningless
    const meaninglessPatterns = [
      /^(this|that|it|the)$/i,
      /^(use|do|make|get|put)$/i,
      /^[a-z]{1,3}$/i // Very short words
    ];

    if (meaninglessPatterns.some(pattern => pattern.test(rule.rule_text))) {
      return false;
    }

    // Skip rules with low confidence
    if (rule.confidence < 0.3) {
      return false;
    }

    return true;
  }

  /**
   * Remove duplicate and similar rules
   */
  private deduplicateRules(rules: DetectedRule[]): DetectedRule[] {
    const unique: DetectedRule[] = [];
    
    for (const rule of rules) {
      const isDuplicate = unique.some(existing => 
        existing.rule_text.toLowerCase() === rule.rule_text.toLowerCase() ||
        this.isSimilarRule(existing, rule)
      );
      
      if (!isDuplicate) {
        unique.push(rule);
      }
    }

    // Sort by confidence score
    return unique.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Check if two rules are similar enough to be considered duplicates
   */
  private isSimilarRule(rule1: DetectedRule, rule2: DetectedRule): boolean {
    if (rule1.category !== rule2.category) return false;
    
    const text1 = rule1.rule_text.toLowerCase();
    const text2 = rule2.rule_text.toLowerCase();
    
    // Simple similarity check - if 80% of words overlap
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    
    const overlap = words1.filter(word => words2.includes(word)).length;
    const similarity = overlap / Math.max(words1.length, words2.length);
    
    return similarity > 0.8;
  }

  /**
   * Apply detected rules to workspace feedback steps
   */
  private async applyRulesToWorkspace(workspaceId: string, rules: DetectedRule[]): Promise<any> {
    const results = {
      rules_detected: rules.length,
      rules_applied: 0,
      rules_skipped: 0,
      workspace_rules_updated: false,
      detected_rules: rules,
      errors: [] as string[]
    };

    try {
      // Get existing workspace_rules feedback step
      let workspaceRules = await this.db.get<any>(
        'SELECT * FROM feedback_steps WHERE name = ? AND workspace_id = ?',
        ['workspace_rules', workspaceId]
      );

      let currentRules = '';
      if (workspaceRules) {
        currentRules = workspaceRules.instructions;
      } else {
        // Create initial workspace rules feedback step
        const stepId = `ws_rules_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        currentRules = '# Workspace-Specific Rules and Guidelines\n\n## Custom Rules\n\n';
        
        await this.db.run(
          `INSERT INTO feedback_steps (id, name, instructions, workspace_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [stepId, 'workspace_rules', currentRules, workspaceId, new Date().toISOString(), new Date().toISOString()]
        );
        
        workspaceRules = { id: stepId, instructions: currentRules };
        results.workspace_rules_updated = true;
      }

      // Add new rules to the workspace rules
      for (const rule of rules) {
        try {
          if (this.isRuleAlreadyPresent(currentRules, rule)) {
            results.rules_skipped++;
            continue;
          }

          const formattedRule = this.formatRuleForWorkspace(rule);
          currentRules = this.insertRuleIntoRules(currentRules, formattedRule, rule.category);
          results.rules_applied++;
        } catch (error) {
          results.errors.push(`Failed to apply rule "${rule.rule_text}": ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Update the workspace rules feedback step
      if (results.rules_applied > 0) {
        await this.db.run(
          'UPDATE feedback_steps SET instructions = ?, updated_at = ? WHERE id = ?',
          [currentRules, new Date().toISOString(), workspaceRules.id]
        );
        results.workspace_rules_updated = true;
      }

    } catch (error) {
      results.errors.push(`Failed to update workspace rules: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return results;
  }

  /**
   * Check if a rule is already present in the workspace rules
   */
  private isRuleAlreadyPresent(currentRules: string, rule: DetectedRule): boolean {
    const lowerRules = currentRules.toLowerCase();
    const lowerRuleText = rule.rule_text.toLowerCase();
    
    // Check for exact match or very similar text
    return lowerRules.includes(lowerRuleText) || 
           lowerRules.includes(rule.trigger_phrase.toLowerCase());
  }

  /**
   * Format a rule for inclusion in workspace rules
   */
  private formatRuleForWorkspace(rule: DetectedRule): string {
    const timestamp = new Date().toISOString().split('T')[0];
    
    const rulePrefix = {
      'never': '❌ **NEVER**',
      'always': '✅ **ALWAYS**',
      'remember': '📝 **REMEMBER**',
      'dont': '🚫 **DON\'T**',
      'preference': '⭐ **PREFER**'
    }[rule.rule_type] || '📋 **RULE**';

    return `- ${rulePrefix}: ${rule.rule_text} *(${rule.original_context}, ${timestamp})*`;
  }

  /**
   * Insert a rule into the appropriate section of workspace rules
   */
  private insertRuleIntoRules(currentRules: string, formattedRule: string, category: string): string {
    const categoryHeaders: Record<string, string> = {
      'testing': '## Testing Requirements',
      'git_workflow': '## Git Workflow',
      'coding_standards': '## Coding Standards',
      'file_management': '## File Organization',
      'dependencies': '## Dependencies',
      'performance': '## Performance Considerations',
      'security': '## Security Guidelines',
      'ui_ux': '## UI/UX Guidelines',
      'api_design': '## API Design',
      'database': '## Database Operations',
      'general': '## Custom Rules'
    };

    const sectionHeader = categoryHeaders[category] || categoryHeaders['general'];
    
    if (currentRules.includes(sectionHeader)) {
      // Insert into existing section
      const sectionIndex = currentRules.indexOf(sectionHeader);
      const nextSectionIndex = currentRules.indexOf('\n## ', sectionIndex + 1);
      
      if (nextSectionIndex === -1) {
        // Last section
        return currentRules + '\n' + formattedRule;
      } else {
        // Insert before next section
        return currentRules.slice(0, nextSectionIndex) + '\n' + formattedRule + currentRules.slice(nextSectionIndex);
      }
    } else {
      // Create new section
      return currentRules + '\n' + sectionHeader + '\n' + formattedRule + '\n';
    }
  }
}
