/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://imicorp.com.sg;" },
          { key: "X-Frame-Options", value: "ALLOW-FROM https://imicorp.com.sg" }
        ]
      }
    ];
  }
};

export default nextConfig;
