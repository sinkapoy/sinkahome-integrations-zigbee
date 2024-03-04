import { inspect } from "util";
import { Controller } from "zigbee-herdsman";
import { Definition, Expose, findByDevice } from "zigbee-herdsman-converters";
import { Device } from "zigbee-herdsman/dist/controller/model";


export enum ZigbeeDeviceType {
    CONTROLLER,
    END_DEVICE,
}

export class ZigbeeDeviceDefinition {
    definition?: Definition;
    exposes?: Expose[];
    constructor(
        public device: Device,
        public readonly controller: Controller,
    ) {
    }

    async getDefinition(configure = false) {
        this.definition = await findByDevice(this.device, true);
        if (configure)
            try {
                if (this.definition.configure)
                    await this.definition.configure(
                        this.device,
                        this.controller.getDevicesByType('Coordinator')[0].endpoints[0],
                        console
                    ).catch((reason) => {
                        console.error(reason);
                    });
            } catch (e) {
                console.error('error configue zigbee device');
                console.error(e);
            }
        if (this.definition.exposes) {
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
        }
    }
}
