/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // Use NEXT_PUBLIC_API_URL if set, otherwise fall back to the Cloud Run URL
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'https://web3-guard-solana-173382554287.europe-west1.run.app'}/:path*`, 
      },
    ];
  },
};

export default nextConfig;
