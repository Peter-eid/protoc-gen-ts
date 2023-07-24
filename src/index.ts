import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";

import * as plugin from "./compiler/plugin";
import * as type from "./type";
import * as descriptor from "./descriptor";
import * as op from "./option";

import * as rpc_node from "./rpc/node";
import * as rpc_web from "./rpc/web";
import * as rpc_server from "./rpc/server";


function createImport(
  identifier: ts.Identifier,
  moduleSpecifier: string,
): ts.ImportDeclaration {
  return ts.factory.createImportDeclaration(
    undefined,
    ts.factory.createImportClause(
      false,
      ts.factory.createNamespaceImport(identifier) as any,
      undefined,
    ),
    ts.factory.createStringLiteral(moduleSpecifier),
  );
}

function replaceExtension(filename: string, extension: string = ".ts"): string {
  return filename.replace(/\.[^/.]+$/, extension);
}


const request = plugin.CodeGeneratorRequest.deserialize(
  new Uint8Array(fs.readFileSync(process.stdin.fd)),
);
const response = new plugin.CodeGeneratorResponse({
  supported_features:
    plugin.CodeGeneratorResponse.Feature.FEATURE_PROTO3_OPTIONAL,
  file: [],
});

const [tsVersionMajor, tsVersionMinor] = ts.version.split(".").map(Number);

if (!(tsVersionMajor >= 5 || (tsVersionMajor >= 4 && tsVersionMinor >= 9))) {
  response.error = "protoc-gen-ts requires TypeScript 4.9 or above.";
  process.stdout.write(response.serialize());
  // will help to flush the stdout buffer.
  process.stdout.write(new Uint8Array());
  process.exit();
}

const options = op.parse(request.parameter);

type.initialize(options);
descriptor.initialize(options);

for (const fileDescriptor of request.proto_file) {
  type.preprocess(fileDescriptor, fileDescriptor.name, `.${fileDescriptor.package ?? ""}`);
}

for (const fileDescriptor of request.proto_file) {
  const name = replaceExtension(fileDescriptor.name);
  const pbIdentifier = ts.factory.createUniqueName("pb");
  const grpcIdentifier = ts.factory.createUniqueName("grpc");
  const grpcWebIdentifier = ts.factory.createUniqueName("grpc_web");

  // Will keep track of import statements
  const importStatements: ts.ImportDeclaration[] = [
    // Create all named imports from dependencies
    ...fileDescriptor.dependency.map((dependency: string) => {
      const identifier = ts.factory.createUniqueName(`dependency`);
      const moduleSpecifier = replaceExtension(dependency, "");
      type.setIdentifierForDependency(dependency, identifier);

      return createImport(
        identifier,
        `./${path.relative(
          path.dirname(fileDescriptor.name),
          moduleSpecifier,
        )}`,
      );
    }),
  ];

  // Create all messages recursively
  let statements: ts.Statement[] = [
    // Process enums
    ...fileDescriptor.enum_type.map((enumDescriptor) =>
      descriptor.createEnum(enumDescriptor),
    ),

    // Process root messages
    ...fileDescriptor.message_type.flatMap((messageDescriptor) =>
      descriptor.processDescriptorRecursively(
        fileDescriptor,
        messageDescriptor,
        pbIdentifier,
        options.no_namespace
      ),
    ),
  ];

  if (statements.length) {
    importStatements.push(createImport(pbIdentifier, "google-protobuf"));
  }

  if (!options.no_grpc && fileDescriptor.service.length) {
    // Import grpc only if there is service statements
    importStatements.push(createImport(grpcIdentifier, options.grpc_package));

    if (options.target != "web") {
      statements.push(...rpc_server.createGrpcInterfaceType(grpcIdentifier));
    } else {
      // import grc-web when the target is web
      importStatements.push(
        createImport(
          grpcWebIdentifier,
          "grpc-web",
        )
      );
    }

    // Create all services and clients
    for (const serviceDescriptor of fileDescriptor.service) {
      // target: node server
      statements.push(
        rpc_server.createUnimplementedServer(
          fileDescriptor,
          serviceDescriptor,
          grpcIdentifier,
        ),
      );
      // target: web via grpc-web
      if (options.target == "web") {
        statements.push(
          rpc_web.createServiceClient(
            fileDescriptor,
            serviceDescriptor,
            grpcWebIdentifier,
            options,
          ),
        );
      } else {
        // target: node via @grpc/grpc-js or grpc (deprecated)
        statements.push(
          rpc_node.createServiceClient(
            fileDescriptor,
            serviceDescriptor,
            grpcIdentifier,
            options,
          )
        )
      }
    }
  }

  const { major = 0, minor = 0, patch = 0 } = request.compiler_version ?? {};

  const comments = [
    `Generated by the protoc-gen-ts.  DO NOT EDIT!`,
    `compiler version: ${major}.${minor}.${patch}`,
    `source: ${fileDescriptor.name}`,
    `git: https://github.com/thesayyn/protoc-gen-ts`,
    //`target: ${options.target}`
  ];

  if (fileDescriptor.options?.deprecated) {
    comments.push("@deprecated");
  }

  const doNotEditComment = ts.factory.createJSDocComment(comments.join("\n")) as ts.Statement;

  // Wrap statements within the namespace
  if (fileDescriptor.package && !options.no_namespace) {
    statements = [
      doNotEditComment,
      ...importStatements,
      descriptor.createNamespace(fileDescriptor.package, statements),
    ];
  } else {
    statements = [doNotEditComment, ...importStatements, ...statements];
  }

  const sourcefile: ts.SourceFile = ts.factory.createSourceFile(
    statements,
    ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
    ts.NodeFlags.None,
  );
  // @ts-ignore
  sourcefile.identifiers = new Set();

  const content = ts
    .createPrinter({
      newLine: ts.NewLineKind.LineFeed,
      omitTrailingSemicolon: true,
    })
    .printFile(sourcefile);

  response.file.push(
    new plugin.CodeGeneratorResponse.File({
      name,
      content,
    }),
  );

  // after each iteration we need to clear the dependency map to prevent accidental
  // misuse of identifiers
  type.resetDependencyMap();
}

process.stdout.write(response.serialize());