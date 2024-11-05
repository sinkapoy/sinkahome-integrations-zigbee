import { serviceLocator } from '@sinkapoy/home-core';
import { dirname, join } from 'path';

interface IControllerConfig {
    network: {
        panID: number;
        extendedPanID?: number[];
        channelList: number[];
        networkKey: number[];
    };
    serialPort: {
        path: string;
        adapter?: string;
        baudrate?: number;
    };
    databasePath?: string;
    regex?: string;
}

export class SaveController {
    constructor (
        private readonly savePath: string,
    ) {
        this.checkConfigFile();
    }

    async checkConfigFile () {
        const files = serviceLocator().get('files');

        if (!(await files.exist(this.savePath))) {
            // console.log('mkdir for zigbee')
            await files.mkdir(dirname(this.savePath));
            await files.write(this.savePath, '[]');
        }
    }

    async readConfig (): Promise<IControllerConfig[]> {
        try {
            const save = JSON.parse(await serviceLocator().get('files').read(this.savePath)) as IControllerConfig[];
            save.forEach(s => { this.applyDefaultSettings(s); });
            await this.writeConfig(save);
            return save;
        } catch (e) {
            console.error(e);
            return [];
        }
    }

    writeConfig (config: IControllerConfig[]) {
        // console.log(config)
        return serviceLocator().get('files').write(this.savePath, JSON.stringify(config, undefined, 2));
    }

    private applyDefaultSettings (config: IControllerConfig) {
        if (!config.network) {
            config.network = {
                panID: (0xFFFF * Math.random()) << 0,
                channelList: [11],
                networkKey: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
            };
        }
        if (!config.network.extendedPanID) {
            config.network.extendedPanID = this.generateExtPanID();
        }
        if (!config.serialPort) {
            config.serialPort = {
                path: '/dev/serial/by-id/your-usb-dongle',
            };
        }
        if (!config.databasePath) {
            config.databasePath = join(dirname(this.savePath), 'controller' + (Math.random() * 16536 >> 0) + '.json');
        }
    }

    private generateExtPanID (): number[] {
        const array: number[] = [];
        array[7] = 0;
        const key = array.map(() => ((Math.random() * 256) >> 0));
        return key;
    }
}
