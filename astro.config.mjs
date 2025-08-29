// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

import vercel from '@astrojs/vercel';
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import {autolinkConfig} from "./src/plugins/rehype-autolink-config.js";

import tailwindcss from '@tailwindcss/vite';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://blog.nuer.me',
  integrations: [mdx(), sitemap(), react()],

  markdown: {
    rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, autolinkConfig]],
  },
  adapter: vercel({
    edgeMiddleware: true,
    imageService: true,
    devImageService: 'sharp',
    webAnalytics: {
      enabled: true,
    },
    maxDuration: 8
  }),
  image: {
    domains: ['7bd63f5b50a7ddf2cf2040355fc00508.r2.cloudflarestorage.com', '7bd63f5b50a7ddf2cf2040355fc00508.r2.cloudflarestorage.com/blog', 'r2os.nuerk.me']
  },

  output: 'static',

  vite: {
    plugins: [tailwindcss()],
    assetsInclude: ["**/*.HEIC", "**/*.jpeg"],
  }
});
