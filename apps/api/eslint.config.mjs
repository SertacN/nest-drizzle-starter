// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	{ ignores: ['dist', 'node_modules', 'eslint.config.mjs', 'drizzle.config.ts'] },
	eslint.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	eslintPluginPrettierRecommended,
	{
		languageOptions: {
			globals: { ...globals.node },
			parserOptions: {
				// scripts/ is outside tsconfig's rootDir (it is never compiled into dist), so it
				// belongs to no project — allowDefaultProject lints it anyway.
				projectService: { allowDefaultProject: ['scripts/*.ts'] },
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			// Decorator metadata makes plenty of Nest values `any` at the type level; erroring on
			// every one of them buries the findings that matter.
			'@typescript-eslint/no-explicit-any': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'warn',
			'@typescript-eslint/no-unsafe-member-access': 'warn',
			'@typescript-eslint/no-unsafe-argument': 'warn',
			'@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
		},
	},
);
