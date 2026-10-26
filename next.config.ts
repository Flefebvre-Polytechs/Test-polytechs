import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDFKit reads its font metrics beside its installed module. Keep the Node
  // package external so those paths remain valid in the production server.
  serverExternalPackages: ['pdfkit', 'sharp'],
};

export default nextConfig;
