/** @type {import('next').NextConfig} */
const nextConfig = {
  // orangekit-smart-account and orangekit-contracts (via Passport) ship untranspiled TypeScript.
  transpilePackages: [
    "@mezo-org/passport",
    "@mezo-org/orangekit",
    "@mezo-org/orangekit-smart-account",
    "@mezo-org/orangekit-contracts",
  ],
  webpack: (config, { webpack }) => {
    // wagmi's Base Account connector pulls @coinbase/cdp-sdk, whose x402 helpers import optional
    // @x402/* packages that are not installed. Mezher never uses that connector, so skip them.
    config.plugins.push(new webpack.IgnorePlugin({ resourceRegExp: /^@x402\// }));
    return config;
  },
};

export default nextConfig;
