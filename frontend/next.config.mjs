/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // Fallback to local API if NEXT_PUBLIC_API_URL isn't set
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/:path*`, 
      },
    ];
  },
};

export default nextConfig;
