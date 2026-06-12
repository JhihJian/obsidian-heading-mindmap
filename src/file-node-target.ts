export function resolveFileNodePath(storedPath: string, resolvedPath: string | undefined): string {
  return resolvedPath ?? storedPath;
}
