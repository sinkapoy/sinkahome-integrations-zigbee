import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';

export default {
        input: 'node_modules/zigbee-herdsman/dist/index.js',
        output: [
            {
                file: 'dist/zh/index.js',
                format: 'cjs',
                sourcemap: false,
            }
        ],
        plugins: [
            commonjs({ extensions: ['.js', '.ts'] , dynamicRequireRoot: "node_modules/zigbee-herdsman/dist", dynamicRequireTargets: [
                "node_modules/zigbee-herdsman/dist/adapter/z-stack/adapter/zStackAdapter.js"
            ]}),
            nodeResolve({ preferBuiltins: true,  extensions: ['.mjs', '.js', '.json', '.node', '.ts'], 
                
            }),
        ]
    };