# This is NOT the Next.js you know

This project uses Next.js 16, which has breaking changes — APIs, conventions, and file
structure may differ from older training data. Notably the old `middleware.ts` is now
`src/proxy.ts` (exporting `proxy`). When in doubt, read the guides in
`node_modules/next/dist/docs/` before writing framework code, and mirror the patterns in
the sibling `../Staging App/staging-app` project, which targets the same Next 16.
