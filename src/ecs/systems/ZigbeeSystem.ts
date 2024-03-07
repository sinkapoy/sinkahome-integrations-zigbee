
import { HomeSystem, PropertiesComponent, serviceLocator } from "@sinkapoy/home-core";
import { Controller } from "zigbee-herdsman";
import { Device, Endpoint } from "zigbee-herdsman/dist/controller/model";

import { ZigbeeDeviceDefinition } from "../components/ZigbeeDevice";
import { Entity } from "@ash.ts/ash";
import { ZigbeeEndDeviceNode } from "../nodes/ZigbeeEndDeviceNode";
import { createZigbeeController, createZigbeeGadget, getUuidByZigbeeDevice } from "src/utils/createZigbeeDevice";
import { SaveController } from "src/utils/SaveController";

interface IZhmPermitJoinChangedPayload {
    permitted: boolean;
    reason: 'timer_expired' | 'manual';
    timeout: number;
}

export class ZigbeeSystem extends HomeSystem {
    private saveController: SaveController;

    onInit(): void {
        this.saveController = new SaveController('./server-data/integrations/zigbee/coordinators.json');
        this.addCoordinatorsFromConfig();
        this.setupEvent('writeGadgetProperty', this.writeProperty.bind(this))
        this.setupNodeList({
            node: ZigbeeEndDeviceNode,
            onAdd: this.onGadgetAdd.bind(this),
        })
    }

    onUpdate(dt: number): void {

    }

    onDestroy(): void {

    }

    onGadgetAdd(node: ZigbeeEndDeviceNode) {
        //
    }

    writeProperty(entity: Entity, propId: string, value: any) {
        if (!entity.has(Controller)) return;
        const props = entity.get(PropertiesComponent);
        if (!props) return;
        const controller = entity.get(Controller)!
        switch (propId) {
            case 'join:permit':
                controller.permitJoin(!!value);
                props.get('join:permit')!.value = !!value;
                break;
            case 'join:permit-time':
                controller.permitJoin(!!value, undefined, Number(value));
                props.get('join:permit-time')!.value = Number(value);
                break;
        }
    }


    async addCoordinatorsFromConfig() {
        const logger = {
            debug: console.log.bind(console),
            log: console.log.bind(console),
            error: console.log.bind(console),
            warn: console.log.bind(console),
            info: console.log.bind(console),
        }
        const save = await this.saveController.readConfig();
        for (const s of save) {
            const options = {
                ...s,
            }
            try {
                const controller = new Controller(options as any, logger);
                const controllerEntity = createZigbeeController(controller, s.serialPort.path);
                const controllerProperties = controllerEntity.get(PropertiesComponent)!;
                controller.on('deviceInterview', (data: { status: 'started' | 'successful' | 'failed'; device: Device }) => {
                    if (data.status === 'successful') {
                        const entity = createZigbeeGadget(data.device, controller, false);
                        const oldEntity = this.engine.getEntityByName(entity.name);
                        if (oldEntity) {
                            this.engine.removeEntity(oldEntity);
                        }
                        try {
                            this.engine.addEntity(entity);
                        } catch (e) {
                            console.error(e);
                        }
                    }
                });
                controller.on('message', (data) => {
                    // console.log('zigbee msg', data);
                    this.onMessage(data, controller);
                })

                controller.on('permitJoinChanged', (data: IZhmPermitJoinChangedPayload) => {
                    controllerProperties.get('join:permit-time')!.value = data.timeout;
                    controllerProperties.get('join:permit')!.value = data.permitted;

                    this.engine.emit('gadgetPropertyEvent', controllerEntity, controllerProperties.get('join:permit-time')!);
                    this.engine.emit('gadgetPropertyEvent', controllerEntity, controllerProperties.get('join:permit')!);
                });

                controller.start().catch((e) => {
                    console.error(e);
                }).then(() => {
                    // @ts-expect-error
                    console.log(controller.database);
                    try {
                        controller.permitJoin(true, undefined, 600);
                        this.engine.addEntity(controllerEntity);
                        controller.getDevicesByType('EndDevice').forEach(d => {
                            const gadget = createZigbeeGadget(d, controller, true);
                            this.engine.addEntity(gadget);
                        });
                    } catch (e) {
                        console.error(e);
                    }

                });
            } catch (e) {
                console.error(e);
            }
        }
    }

    async onMessage(data: {
        type: 'raw' | 'readResponse' | 'attributeReport' | 'read',
        device: Device,
        endpoint: Endpoint,
        data: Buffer | Record<string, any>,
        linkquality: number,
        groupId: number,
        cluster: string,
        meta: any,
    }, controller: Controller) {
        // @ts-expect-error zhm code =)
        const database = controller.database;
        console.log(database)
        const entity = this.engine.getEntityByName(getUuidByZigbeeDevice(data.device));
        if (!entity) {
            console.error('cant find entity', getUuidByZigbeeDevice(data.device));
            return;
        }
        const defs = entity.get(ZigbeeDeviceDefinition);
        const props = entity.get(PropertiesComponent)!;
        if (!defs?.exposes || !defs?.definition) {
            console.error('device has no definition ' + defs?.device.modelID);
            return;
        }



        console.log('msg from ' + defs.device.modelID);
        const fromZigbee = defs.definition?.fromZigbee;
        if (!fromZigbee) {
            console.error('no from zigbee for device ' + defs.device.modelID);
            return;
        }
        for (const rule of fromZigbee) {
            console.log(rule);
            console.log(data.cluster, data.type)
            const meta = {
                device: data.device,
                logger: console,
                state: {}, // todo: state
                deviceExposesChanged: () => { },
            }
            if (rule.cluster === data.cluster && (rule.type === data.type || rule.type.indexOf(data.type) > -1)) {
                const result = await rule.convert(
                    defs.definition,
                    data as any,
                    (data) => { console.log('zigbee publish', data) },
                    (Object.values(database.entries) as any[]).filter(d => d.ieeeAddr === data.device.ieeeAddr)[0] || {},
                    meta,

                ) || {};
                for (const key in result) {
                    if (props.has(key)) {
                        const prop = props.get(key)!;
                        prop.value = result[key];
                        this.engine.emit('gadgetPropertyEvent', entity, prop);
                    }
                }
                console.log('===========');
                console.log(defs.device.modelID);
                console.log('msg', result);
            }
        }
    }

}