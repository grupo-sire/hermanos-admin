import { useEmpresa } from "@/contexts/EmpresaContext";

/**
 * Returns a function to build slug-prefixed paths.
 * Usage: const path = buildPath("/dashboard") => "/vira/dashboard"
 */
export function useSlug() {
  const { config } = useEmpresa();
  const slug = config.slug;

  const buildPath = (path: string) => {
    if (!slug) return path;
    // Ensure path starts with /
    const cleanPath = path.startsWith("/") ? path : `/${path}`;
    return `/${slug}${cleanPath}`;
  };

  return { slug, buildPath };
}
