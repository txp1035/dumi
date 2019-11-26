import path from 'path';
import * as babel from '@babel/core';
import * as types from '@babel/types';
import traverse from '@babel/traverse';
import generator from '@babel/generator';

export const DEMO_COMPONENT_NAME = 'FatherDocDemo';

/**
 * transform code block statments to preview
 */
export default (raw: string, dir: string, isTSX?: boolean) => {
  const code = babel.transformSync(raw, {
    presets: [
      require.resolve('@babel/preset-react'),
      require.resolve('@babel/preset-env'),
    ],
    plugins: (isTSX
      ? [[require.resolve('@babel/plugin-transform-typescript'), { isTSX: true }]]
      : []
    ),
    ast: true,
  });
  const body = code.ast.program.body as types.Statement[];
  let returnStatement;

  // traverse call expression
  traverse(code.ast, {
    CallExpression(callPath) {
      const nodeCallee = callPath.node.callee;

      // remove original render expression
      if (
        types.isMemberExpression(nodeCallee)
        && nodeCallee.object
        && (nodeCallee.object.loc as any).identifierName === 'ReactDOM'
        && nodeCallee.property
        && nodeCallee.property.name === 'render'
        && types.isExpression(callPath.node.arguments[0])
      ) {
        // save render expression as return statement
        returnStatement = types.returnStatement(callPath.node.arguments[0]);
        callPath.remove();
      }

      // replace relative module path
      if (
        dir
        && types.isIdentifier(nodeCallee)
        && nodeCallee.name === 'require'
        && types.isStringLiteral(callPath.node.arguments[0])
        && callPath.node.arguments[0].value.startsWith('.')
      ) {
        callPath.node.arguments[0].value = path.join(dir, callPath.node.arguments[0].value);
      }
    },
  });

  // push return statement to program body
  if (returnStatement) {
    body.push(returnStatement);
  }

  // create demo function
  const demoFunction = types.functionDeclaration(
    types.identifier(DEMO_COMPONENT_NAME),
    [],
    types.blockStatement(body),
  );

  return generator(types.program([demoFunction]), {}, raw).code;
}
