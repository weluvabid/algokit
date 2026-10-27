import { parse } from "@babel/parser";
import type { NodePath } from "@babel/traverse";
import traverseModule from "@babel/traverse";
import generateModule from "@babel/generator";
import type * as t from "@babel/types";

type TraverseFn = typeof traverseModule extends { default: infer T } ? T : typeof traverseModule;
type GenerateFn = typeof generateModule extends { default: infer T } ? T : typeof generateModule;

const traverse: TraverseFn = ((traverseModule as unknown as { default?: TraverseFn }).default ??
  traverseModule) as TraverseFn;
const generate: GenerateFn = ((generateModule as unknown as { default?: GenerateFn }).default ??
  generateModule) as GenerateFn;

export interface TransformResult {
  readonly code: string;
  readonly removedCalls: number;
}

export function stripTrace(source: string, filename = "input.ts"): TransformResult {
  const ast = parse(source, {
    sourceType: "module",
    sourceFilename: filename,
    plugins: ["typescript"],
  });
  const removals = new Set<t.Node>();
  let removedCalls = 0;

  traverse(ast, {
    Program(path: NodePath<t.Program>) {
      const traceBindings = path.scope.bindings["trace"];
      const traceImport = traceBindings?.path;

      if (!traceBindings) return;

      if (!traceImport?.isImportNamespaceSpecifier()) {
        throw new Error(`${filename}: the reserved trace binding must be a namespace import`);
      }

      for (const reference of traceBindings.referencePaths) {
        const member = reference.parentPath;
        const call = member?.parentPath;
        const statement = call?.parentPath;

        if (
          !member?.isMemberExpression() ||
          member.node.object !== reference.node ||
          !call?.isCallExpression() ||
          call.node.callee !== member.node ||
          !statement?.isExpressionStatement() ||
          statement.node.expression !== call.node
        ) {
          throw new Error(`${filename}: trace references must be standalone trace calls`);
        }

        removals.add(statement.node);
        removedCalls++;
      }

      removals.add(traceImport.parentPath.node);
    },
  });

  traverse(ast, {
    enter(path) {
      if (removals.has(path.node)) path.remove();
    },
  });

  return { code: generate(ast, { comments: true }, source).code, removedCalls };
}
