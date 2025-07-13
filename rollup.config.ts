import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import alias from '@rollup/plugin-alias';

export default [
    {
        input: 'src/index.ts',
        output: [
            {
                file: 'dist/node.js',
                format: 'es',
                sourcemap: true,
            }
        ],
        plugins: [
            json(),
            typescript({
                tsconfig: 'tsconfig.json',
                useTsconfigDeclarationDir: true,
                tsconfigOverride: {
                    declaration: false,
                }
            }),
            nodeResolve({ preferBuiltins: true, }),
            alias({
                entries: [
                    { find: './z-stack/adapter/zStackAdapter', replacement: '/z-stack/adapter/zStackAdapter.js' },
                ]
            }),
            commonjs({
                extensions: ['.js', '.ts'], ignoreDynamicRequires: false, dynamicRequireTargets: [
                    "node_modules/zigbee-herdsman/dist/adapter/**/*.js"
                ],
                ignore: (id)=>{
                    if(id.includes("node-gyp-build")){
                        console.log(id);
                        return true;
                    }
                    return false;
                },
                dynamicRequireRoot: "node_modules/zigbee-herdsman/dist/adapter"
            }),
            

        ],
        external: [
            '@ash.ts/ash',
            '@sinkapoy/home-core',
            '@sinkapoy/home-integrations-networking',
            /node_modules\/@serialport/,
            // /node_modules/
        ]
    }
];