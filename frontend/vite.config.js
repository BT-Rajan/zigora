import {defineConfig} from 'vite'; import react from '@vitejs/plugin-react'
// built with relative paths, so the same build works at /app/ and under a folder of the site (BASE_PATH, e.g. /zigora/app/)
// The libraries go in their own files (React; Markdown and maths; icons), so the browser keeps them cached when only the app's own code changes,
// and no single file passes Vite's 500 kB warning.
const VENDOR=[['react',/node_modules\/(react|react-dom|scheduler)\//],['markdown',/node_modules\/(katex|react-markdown|remark-|rehype-|micromark|mdast-|hast-|unist-|unified|vfile|property-information|space-separated|comma-separated|decode-named|character-|html-url|zwitch|longest-streak|ccount|markdown-table|escape-string|trim-lines|bail|is-plain-obj|trough|devlop|extend|style-to|inline-style|estree-|parse-entities|stringify-entities|web-namespaces|hastscript|html-void|lowlight)/],['icons',/node_modules\/lucide-react\//]]
export default defineConfig(({command})=>({base:command==='build'?'./':'/app/',plugins:[react()],server:{host:true,proxy:{'/api':'http://localhost:8000'}},
  build:{rollupOptions:{output:{manualChunks:id=>VENDOR.find(([,re])=>re.test(id))?.[0]}}}}))
