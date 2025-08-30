import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				// Cyber theme colors
				canvas: 'hsl(var(--bg-canvas))',
				'card-alt': 'hsl(var(--bg-card-alt))',
				'border-main': 'hsl(var(--border-main))',
				'text-primary': 'hsl(var(--text-primary))',
				'text-secondary': 'hsl(var(--text-secondary))',
				'accent-primary': 'hsl(var(--accent-primary))',
				'purple-chip': 'hsl(var(--purple-chip))',
				'teal-chip': 'hsl(var(--teal-chip))'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				card: 'var(--radius-card)',
				input: 'var(--radius-input)',
				pill: 'var(--radius-pill)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'breathe': {
					'0%, 100%': {
						boxShadow: '0 0 30px rgba(255, 255, 255, 0.2)'
					},
					'50%': {
						boxShadow: '0 0 50px rgba(255, 255, 255, 0.4)'
					}
				},
				'breathe-intense': {
					'0%, 100%': {
						boxShadow: '0 0 80px hsl(var(--accent-primary) / 0.48)'
					},
					'50%': {
						boxShadow: '0 0 140px hsl(var(--accent-primary) / 0.8)'
					}
				},
				'loading-spin': {
					'0%': {
						boxShadow: '0 0 80px hsl(var(--accent-primary) / 0.8), 0 -40px 0 -30px hsl(var(--accent-primary))',
						transform: 'rotate(0deg)'
					},
					'100%': {
						boxShadow: '0 0 80px hsl(var(--accent-primary) / 0.8), 0 -40px 0 -30px hsl(var(--accent-primary))',
						transform: 'rotate(360deg)'
					}
				},
				'waveform-1': { '0%, 100%': { height: '20px' }, '50%': { height: '60px' } },
				'waveform-2': { '0%, 100%': { height: '40px' }, '33%': { height: '45px' }, '66%': { height: '25px' } },
				'waveform-3': { '0%, 100%': { height: '15px' }, '25%': { height: '55px' }, '75%': { height: '30px' } },
				'waveform-4': { '0%, 100%': { height: '50px' }, '40%': { height: '20px' }, '80%': { height: '65px' } },
				'waveform-5': { '0%, 100%': { height: '30px' }, '20%': { height: '45px' }, '60%': { height: '15px' } },
				'waveform-6': { '0%, 100%': { height: '35px' }, '50%': { height: '60px' } },
				'waveform-7': { '0%, 100%': { height: '25px' }, '30%': { height: '50px' }, '70%': { height: '40px' } },
				'waveform-8': { '0%, 100%': { height: '45px' }, '25%': { height: '20px' }, '75%': { height: '55px' } },
				'waveform-9': { '0%, 100%': { height: '20px' }, '40%': { height: '65px' }, '80%': { height: '35px' } },
				'waveform-10': { '0%, 100%': { height: '40px' }, '50%': { height: '25px' } },
				'glow-spin': {
					'0%': {
						transform: 'rotate(0deg)',
						boxShadow: '0 0 100px hsl(var(--accent-primary) / 0.7)'
					},
					'100%': {
						transform: 'rotate(360deg)',
						boxShadow: '0 0 120px hsl(var(--accent-primary) / 0.9)'
					}
				},
				'wave-flow': {
					'0%, 100%': {
						transform: 'scaleX(1) scaleY(1)',
						opacity: '0.8'
					},
					'25%': {
						transform: 'scaleX(1.2) scaleY(0.8)',
						opacity: '1'
					},
					'50%': {
						transform: 'scaleX(0.8) scaleY(1.2)',
						opacity: '0.9'
					},
					'75%': {
						transform: 'scaleX(1.1) scaleY(0.9)',
						opacity: '1'
					}
				},
				'scroll-text': {
					'0%': {
						transform: 'translateX(0%)'
					},
					'50%': {
						transform: 'translateX(-30%)'
					},
					'100%': {
						transform: 'translateX(0%)'
					}
				},
				'scroll-text-reveal': {
					'0%, 20%': { 
						transform: 'translateX(0)'
					},
					'80%, 100%': { 
						transform: 'translateX(calc(-100% + 8rem))'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'breathe': 'breathe 6s ease-in-out infinite',
				'breathe-intense': 'breathe-intense 4s ease-in-out infinite',
				'glow-spin': 'glow-spin 2s linear infinite',
				'wave-flow': 'wave-flow 0.8s ease-in-out infinite',
				'loading-spin': 'loading-spin 1.5s linear infinite',
				'waveform-1': 'waveform-1 0.6s ease-in-out infinite',
				'waveform-2': 'waveform-2 0.8s ease-in-out infinite',
				'waveform-3': 'waveform-3 0.7s ease-in-out infinite',
				'waveform-4': 'waveform-4 0.9s ease-in-out infinite',
				'waveform-5': 'waveform-5 0.5s ease-in-out infinite',
				'waveform-6': 'waveform-6 0.75s ease-in-out infinite',
				'waveform-7': 'waveform-7 0.65s ease-in-out infinite',
				'waveform-8': 'waveform-8 0.85s ease-in-out infinite',
				'waveform-9': 'waveform-9 0.55s ease-in-out infinite',
				'waveform-10': 'waveform-10 0.8s ease-in-out infinite',
				'scroll-text': 'scroll-text 4s ease-in-out infinite',
				'scroll-text-reveal': 'scroll-text-reveal 3s ease-in-out infinite 1s'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
