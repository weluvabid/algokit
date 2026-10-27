import * as ts from "typescript";

const TRACE_MODULE = "#trace";

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

function entityNameRoot(name: ts.EntityName): string | undefined {
  let root = name;
  while (ts.isQualifiedName(root)) root = root.left;
  return ts.isIdentifier(root) ? root.text : undefined;
}

function typeReferenceNames(node: ts.Node): Set<string> {
  const names = new Set<string>();
  walk(node, (child) => {
    if (ts.isTypeReferenceNode(child)) {
      const name = entityNameRoot(child.typeName);
      if (name) names.add(name);
    } else if (ts.isTypeQueryNode(child)) {
      const name = entityNameRoot(child.exprName);
      if (name) names.add(name);
    } else if (ts.isExpressionWithTypeArguments(child) && ts.isIdentifier(child.expression)) {
      names.add(child.expression.text);
    }
  });
  return names;
}

function importedNames(clause: ts.ImportClause): Set<string> {
  const names = new Set<string>();
  if (clause.name) names.add(clause.name.text);
  if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
    names.add(clause.namedBindings.name.text);
  } else if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
    for (const element of clause.namedBindings.elements) names.add(element.name.text);
  }
  return names;
}

function typeDeclarationName(statement: ts.Statement): string | undefined {
  if (
    (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) &&
    statement.name
  ) {
    return statement.name.text;
  }
  return undefined;
}

export interface DeclarationTransformResult {
  readonly code: string;
  readonly removedMembers: number;
  readonly removedDeclarations: readonly string[];
}

/** Removes declaration members whose types depend on types imported from #trace. */
export function stripTraceDeclarations(
  source: string,
  filename = "input.d.ts",
): DeclarationTransformResult {
  const sourceFile = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true);
  const traceNames = new Set<string>();
  const traceImports = new Set<ts.ImportDeclaration>();

  for (const statement of sourceFile.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === TRACE_MODULE &&
      statement.importClause
    ) {
      traceImports.add(statement);
      for (const name of importedNames(statement.importClause)) traceNames.add(name);
    }
  }

  if (traceNames.size === 0) {
    return { code: source, removedMembers: 0, removedDeclarations: [] };
  }

  const declarations = new Map<string, ts.Statement>();
  for (const statement of sourceFile.statements) {
    const name = typeDeclarationName(statement);
    if (name) declarations.set(name, statement);
  }

  const dependsOnTrace = (node: ts.Node, seen = new Set<string>()): boolean => {
    for (const name of typeReferenceNames(node)) {
      if (traceNames.has(name)) return true;
      if (seen.has(name)) continue;
      const declaration = declarations.get(name);
      if (!declaration) continue;
      const nextSeen = new Set(seen);
      nextSeen.add(name);
      if (dependsOnTrace(declaration, nextSeen)) return true;
    }
    return false;
  };

  const removedMembers = new Set<ts.Node>();
  const candidateNames = new Set<string>();
  let removedMemberCount = 0;

  walk(sourceFile, (node) => {
    const members =
      ts.isInterfaceDeclaration(node) || ts.isTypeLiteralNode(node) ? node.members : undefined;
    if (!members) return;
    for (const member of members) {
      if (!dependsOnTrace(member)) continue;
      removedMembers.add(member);
      removedMemberCount++;
      for (const name of typeReferenceNames(member)) {
        if (!traceNames.has(name)) candidateNames.add(name);
      }
    }
  });

  const removedDeclarations = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const name of candidateNames) {
      if (removedDeclarations.has(name)) continue;
      const declaration = declarations.get(name);
      if (!declaration) continue;

      let referencedOutsideRemovedMembers = false;
      walk(sourceFile, (node) => {
        if (
          referencedOutsideRemovedMembers ||
          (!ts.isTypeReferenceNode(node) &&
            !ts.isTypeQueryNode(node) &&
            !ts.isExpressionWithTypeArguments(node))
        )
          return;
        let ancestor: ts.Node | undefined = node;
        let insideRemovedDeclaration = false;
        while (ancestor && ancestor !== sourceFile) {
          if (removedMembers.has(ancestor)) return;
          if (
            (ts.isInterfaceDeclaration(ancestor) || ts.isTypeAliasDeclaration(ancestor)) &&
            removedDeclarations.has(ancestor.name.text)
          ) {
            insideRemovedDeclaration = true;
            break;
          }
          ancestor = ancestor.parent;
        }
        if (insideRemovedDeclaration) return;
        const referenceName = ts.isTypeReferenceNode(node)
          ? entityNameRoot(node.typeName)
          : ts.isTypeQueryNode(node)
            ? entityNameRoot(node.exprName)
            : ts.isIdentifier(node.expression)
              ? node.expression.text
              : undefined;
        if (referenceName === name) {
          referencedOutsideRemovedMembers = true;
        }
      });

      if (referencedOutsideRemovedMembers) continue;
      removedDeclarations.add(name);
      for (const childName of typeReferenceNames(declaration)) {
        if (!traceNames.has(childName) && !candidateNames.has(childName)) {
          candidateNames.add(childName);
          changed = true;
        }
      }
      changed = true;
    }
  }

  const transformed = ts.transform(sourceFile, [
    (context) => {
      const visit: ts.Visitor = (node) => {
        if (removedMembers.has(node)) return undefined;
        if (ts.isInterfaceDeclaration(node)) {
          if (removedDeclarations.has(node.name.text)) return undefined;
          const members = node.members.filter((member) => !removedMembers.has(member));
          return context.factory.updateInterfaceDeclaration(
            node,
            node.modifiers,
            node.name,
            node.typeParameters,
            node.heritageClauses,
            members,
          );
        }
        if (ts.isTypeAliasDeclaration(node) && removedDeclarations.has(node.name.text)) {
          return undefined;
        }
        if (ts.isTypeLiteralNode(node)) {
          return context.factory.updateTypeLiteralNode(
            node,
            context.factory.createNodeArray(
              node.members.filter((member) => !removedMembers.has(member)),
            ),
          );
        }
        if (ts.isImportDeclaration(node) && traceImports.has(node)) return undefined;
        return ts.visitEachChild(node, visit, context);
      };
      return (node) => ts.visitNode(node, visit) as ts.SourceFile;
    },
  ]);

  const output = ts.createPrinter().printFile(transformed.transformed[0]!);
  transformed.dispose();
  const outputFile = ts.createSourceFile(filename, output, ts.ScriptTarget.Latest, true);
  let remainingTraceType: string | undefined;
  for (const name of typeReferenceNames(outputFile)) {
    if (traceNames.has(name)) {
      remainingTraceType = name;
      break;
    }
  }
  if (remainingTraceType) {
    throw new Error(
      `${filename}: trace type ${remainingTraceType} remains outside a removable declaration member`,
    );
  }
  return {
    code: output,
    removedMembers: removedMemberCount,
    removedDeclarations: [...removedDeclarations],
  };
}
