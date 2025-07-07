// Design system constants based on the membership card design
export const designSystem = {
    spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '1rem',
        lg: '1.5rem',
        xl: '2rem',
        '2xl': '3rem',
        '3xl': '4rem'
    },
    borderRadius: {
        sm: '0.375rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem'
    },
    colors: {
        accent: {
            green: '#10b981',
            orange: '#f97316',
            yellow: '#eab308',
            purple: '#8b5cf6',
            blue: '#3b82f6'
        },
        neutral: {
            50: '#f9fafb',
            100: '#f3f4f6',
            200: '#e5e7eb',
            300: '#d1d5db',
            400: '#9ca3af',
            500: '#6b7280',
            600: '#4b5563',
            700: '#374151',
            800: '#1f2937',
            900: '#111827'
        }
    },
    typography: {
        title: {
            fontSize: '1.125rem',
            fontWeight: '600',
            lineHeight: '1.5'
        },
        subtitle: {
            fontSize: '0.875rem',
            fontWeight: '400',
            lineHeight: '1.4'
        },
        caption: {
            fontSize: '0.75rem',
            fontWeight: '400',
            lineHeight: '1.3'
        }
    },
    shadows: {
        sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
    }
} as const

// Helper function to get nested design system values
export function getDesignToken(path: string): any {
    return path.split('.').reduce((obj: any, key) => obj?.[key], designSystem)
}

// Spacing utilities
export const spacing = {
    xs: getDesignToken('spacing.xs'),
    sm: getDesignToken('spacing.sm'),
    md: getDesignToken('spacing.md'),
    lg: getDesignToken('spacing.lg'),
    xl: getDesignToken('spacing.xl'),
    '2xl': getDesignToken('spacing.2xl'),
    '3xl': getDesignToken('spacing.3xl'),
}

// Color utilities
export const colors = {
    accent: getDesignToken('colors.accent'),
    neutral: getDesignToken('colors.neutral'),
}

// Typography utilities
export const typography = {
    title: getDesignToken('typography.title'),
    subtitle: getDesignToken('typography.subtitle'),
    caption: getDesignToken('typography.caption'),
}

// Component style generators
export const createCardStyle = (variant: 'base' | 'hover' = 'base') => {
    const baseStyle = getDesignToken(`components.card.${variant}`)
    return {
        backgroundColor: baseStyle.backgroundColor,
        borderRadius: baseStyle.borderRadius,
        padding: getDesignToken(`spacing.${baseStyle.padding}`),
        boxShadow: getDesignToken(`shadows.${baseStyle.shadow}`),
        border: baseStyle.border,
        ...(variant === 'hover' && {
            transform: baseStyle.transform,
            transition: baseStyle.transition,
        })
    }
}

export const createListItemStyle = (state: 'base' | 'hover' = 'base') => {
    const baseStyle = getDesignToken(`components.listItem.${state}`)
    return {
        backgroundColor: baseStyle.backgroundColor,
        borderRadius: getDesignToken(`borderRadius.${baseStyle.borderRadius}`),
        padding: getDesignToken(`spacing.${baseStyle.padding}`),
        border: baseStyle.border,
        marginBottom: getDesignToken(`spacing.${baseStyle.marginBottom}`),
        ...(state === 'hover' && {
            transition: baseStyle.transition,
        })
    }
}

export const createAccentBarStyle = (color: 'green' | 'orange' | 'yellow' | 'purple' | 'blue') => {
    const barConfig = getDesignToken('components.accentBar')
    const colorValue = getDesignToken(`components.accentBar.variants.${color}.backgroundColor`)

    return {
        width: barConfig.width,
        height: barConfig.height,
        borderRadius: getDesignToken(`borderRadius.${barConfig.borderRadius}`),
        marginRight: getDesignToken(`spacing.${barConfig.marginRight}`),
        backgroundColor: getDesignToken(`colors.${colorValue.replace('accent.', 'accent.')}`),
    }
}

export const createIconContainerStyle = (variant: 'light' | 'primary' = 'light') => {
    const baseStyle = getDesignToken('components.iconContainer.base')
    const variantStyle = getDesignToken(`components.iconContainer.variants.${variant}`)

    return {
        width: baseStyle.width,
        height: baseStyle.height,
        borderRadius: getDesignToken(`borderRadius.${baseStyle.borderRadius}`),
        display: baseStyle.display,
        alignItems: baseStyle.alignItems,
        justifyContent: baseStyle.justifyContent,
        marginRight: getDesignToken(`spacing.${baseStyle.marginRight}`),
        backgroundColor: variant === 'light'
            ? getDesignToken('colors.neutral.100')
            : getDesignToken('colors.accent.blue'),
        color: variantStyle.color || 'inherit',
    }
}

export const createButtonStyle = (variant: 'primary' | 'secondary' = 'primary') => {
    const buttonStyle = getDesignToken(`components.button.${variant}`)

    return {
        backgroundColor: variant === 'primary'
            ? getDesignToken('colors.accent.blue')
            : buttonStyle.backgroundColor,
        color: variant === 'primary'
            ? buttonStyle.color
            : getDesignToken('colors.neutral.700'),
        padding: `${getDesignToken('spacing.sm')} ${getDesignToken('spacing.md')}`,
        borderRadius: getDesignToken(`borderRadius.${buttonStyle.borderRadius}`),
        fontSize: buttonStyle.fontSize,
        fontWeight: buttonStyle.fontWeight,
        border: buttonStyle.border === 'none' ? 'none' : `1px solid ${getDesignToken('colors.neutral.300')}`,
        cursor: buttonStyle.cursor,
    }
}

// CSS class name generators for Tailwind
export const tailwindClasses = {
    card: {
        base: 'bg-white rounded-xl p-6 shadow-md border border-gray-200',
        hover: 'hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 ease-in-out'
    },
    listItem: {
        base: 'bg-white rounded-lg p-4 border border-gray-200 mb-2 flex items-center justify-between',
        hover: 'hover:bg-gray-50 transition-colors duration-150'
    },
    typography: {
        title: 'text-lg font-semibold leading-6',
        subtitle: 'text-sm text-gray-500 leading-tight',
        caption: 'text-xs text-gray-400 leading-tight'
    },
    spacing: {
        xs: 'space-x-1',
        sm: 'space-x-2',
        md: 'space-x-4',
        lg: 'space-x-6',
        xl: 'space-x-8',
        '2xl': 'space-x-12',
        '3xl': 'space-x-16'
    }
}

export default designSystem
