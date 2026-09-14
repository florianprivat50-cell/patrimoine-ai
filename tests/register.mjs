import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
registerHooks({
  resolve(specifier,context,next){try{return next(specifier,context);}catch(error){if(specifier.startsWith('.'))for(const ext of ['.ts','.mts']){const url=new URL(specifier+ext,context.parentURL);if(existsSync(fileURLToPath(url)))return {url:url.href,shortCircuit:true};}throw error;}},
  load(url,context,next){if(/\.(?:ts|mts)$/.test(url))return {format:'module',source:ts.transpileModule(readFileSync(fileURLToPath(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText,shortCircuit:true};return next(url,context);}
});
