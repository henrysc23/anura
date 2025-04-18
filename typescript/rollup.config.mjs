import replace from '@rollup/plugin-replace';
import esbuild from 'rollup-plugin-esbuild';
import del from 'rollup-plugin-delete';
import html from '@rollup/plugin-html';
import postcss from 'rollup-plugin-postcss';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const isDevelopment = process.env.NODE_ENV === 'development';
const distFolder = 'dist';

const config = [
    {
        input: './src/index.ts',
        output: [
            {
                dir: `./${distFolder}`,
                format: 'es',
                sourcemap: isDevelopment,
                entryFileNames: 'bundle-[hash].mjs',
            },
        ],
        plugins: [
            // 🔁 Inject env variables from Amplify into your bundle
            replace({
                preventAssignment: true,
                'import.meta.env.VITE_API_URL': JSON.stringify(process.env.VITE_API_URL),
                'import.meta.env.VITE_STUDY_ID': JSON.stringify(process.env.VITE_STUDY_ID),
                'import.meta.env.VITE_LICENSE_KEY': JSON.stringify(process.env.VITE_LICENSE_KEY),
            }),
            del({ targets: 'dist/*' }),
            nodeResolve(),
            esbuild({
                target: 'ES2022',
                minify: process.env.NODE_ENV === 'production',
            }),
            postcss({ extract: true }),
            html({
                fileName: 'index.html',
                template: ({ bundle, files }) => {
                    return getHtmlTemplate(Object.keys(bundle)[0], files.css[0].fileName);
                }
            })
        ]
    }
];

const getHtmlTemplate = (bundleFileName, cssfileName) => {
return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="${cssfileName}">
    <title>Anura Web Core SDK - Typescript</title>
</head>
<body>
    <section>
        <div class="logo-container">
            <div>
                <img src="anura-web-core-sdk.svg" alt="SVG Image" width="112" height="112">
            </div>
            <div class="header">
                Anura Web Core SDK
            </div>
        </div>
        <hr>
        <div>
            <div>
                <select title="camera-select" id="camera-list"></select>
            </div>
            <button type="button" id="toggle-camera" disabled>Open</button>
            <button type="button" id="toggle-measurement" disabled>Start Measurement</button>
        </div>
    </section>
    <div class="measurement-container">
        <div id="measurement"></div>
    </div>
    <script type="module" src="${bundleFileName}"></script>
</body>
</html>`;    
};

export default config;
