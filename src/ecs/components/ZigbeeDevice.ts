import { type IZhmDatabase } from 'src/interfaces/IZhmDatabase';
import { type Controller } from 'zigbee-herdsman';
import { type Definition, type Expose, findByDevice } from 'zigbee-herdsman-converters';
import { type Device } from 'zigbee-herdsman/dist/controller/model';

export enum ZigbeeDeviceType {
    CONTROLLER,
    END_DEVICE,
}

export class ZigbeeDeviceDefinition {
    definition?: Definition;
    exposes?: Expose[];
    exposesMap = {} as Record<string, Expose>;

    constructor (
        public device: Device,
        public readonly controller: Controller,
    ) {
    }

    async getDefinition (configure = false) {
        this.definition = await findByDevice(this.device, true);
        // if (configure) {
        //     try {
        //         if (this.definition.configure) {
        //             await this.definition.configure(
        //                 this.device,
        //                 this.controller.getDevicesByType('Coordinator')[0].endpoints[0],
        //                 this.definition,
        //             ).catch((reason) => {
        //                 console.error(reason);
        //             });
        //         }
        //     } catch (e) {
        //         console.error('error configue zigbee device');
        //         console.error(e);
        //     }
        // }
        if (this.definition?.exposes) {
            let exposes: Expose[];
            switch (typeof this.definition.exposes) {
                    case 'function': {
                        exposes = this.definition.exposes(this.device, undefined);
                        break;
                    }
                    default:
                        exposes = this.definition.exposes!;
            }
            this.exposes = exposes;
            this.fillMap(exposes);
        }
    }

    private fillMap (exposes: Expose[]) {
        for (const expose of exposes) {
            if (expose.name) {
                this.exposesMap[expose.name] = expose;
            } else if (expose.features?.length) {
                this.fillMap(expose.features);
            }
        }
    }

    restoreAttributes () {
        const { device, controller } = this;
        // @ts-expect-error bad types =)
        const database = controller.database as IZhmDatabase;
        const dbEntry = Object.values(database.entries).filter(entry => entry?.ieeeAddr === device.ieeeAddr)[0];

        if (dbEntry.endpoints) {
            for (const endpoint of Object.values(dbEntry.endpoints)) {
                if (!endpoint.clusters) continue;
                for (const key in endpoint.clusters) {
                    const data = endpoint.clusters[key].attributes;
                    if (data) {
                        // @ts-expect-error bad types in zhm
                        controller.emit('message', {
                            type: 'attributeReport',
                            device,
                            data,
                            cluster: key,
                            endpoint: device.getEndpoint(endpoint.epId),
                            meta: {},
                        });
                    }
                }
            }
        }
    }
}
