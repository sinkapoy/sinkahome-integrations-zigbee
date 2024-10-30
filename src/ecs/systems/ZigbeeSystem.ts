import { HomeSystem, PropertiesComponent } from '@sinkapoy/home-core';
import { Controller } from 'zigbee-herdsman';
import { type Device, type Endpoint } from 'zigbee-herdsman/dist/controller/model';
import { ZigbeeDeviceDefinition } from '../components/ZigbeeDevice';
import { type Entity } from '@ash.ts/ash';
import { ZigbeeEndDeviceNode } from '../nodes/ZigbeeEndDeviceNode';
import { createZigbeeController, createZigbeeGadget, getUuidByZigbeeDevice } from 'src/utils/createZigbeeDevice';
import { SaveController } from 'src/utils/SaveController';
import { tryCatchMethod } from 'src/utils/tryCatchMethod';

interface IZhmPermitJoinChangedPayload {
    permitted: boolean;
    reason: 'timer_expired' | 'manual';
    timeout: number;
}

export class ZigbeeSystem extends HomeSystem {
    private saveController: SaveController;

    onInit (): void {
        this.saveController = new SaveController('./server-data/integrations/zigbee/coordinators.json');
        this.addCoordinatorsFromConfig();
        this.setupEvent('writeGadgetProperty', this.writeProperty.bind(this));
        this.setupEvent('invokeGadgetAction', this.invokeAction.bind(this));
        this.setupNodeList({
            node: ZigbeeEndDeviceNode,
            onAdd: this.onGadgetAdd.bind(this),
        });
    }

    onUpdate (dt: number): void {

    }

    onDestroy (): void {

    }

    onGadgetAdd (node: ZigbeeEndDeviceNode) {
        //
    }

    @tryCatchMethod
    writeProperty (entity: Entity, propId: string, value: any) {
        try {
            const props = entity.get(PropertiesComponent);
            if (!props) return;
            const controller = entity.get(Controller)!;
            if (controller) {
                switch (propId) {
                        case 'join:permit':
                            controller.permitJoin(!!value);
                            props.get('join:permit')!.value = !!value;
                            return;
                        case 'join:permit-time':
                            controller.permitJoin(!!value, undefined, Number(value));
                            props.get('join:permit-time')!.value = Number(value);
                            return;
                }
            }
            const defs = entity.get(ZigbeeDeviceDefinition);
            if (!defs?.definition) return;
            defs.definition.toZigbee?.forEach(converter => {
                if (!converter.key?.includes(propId)) {
                    return;
                }
                if (converter.convertSet) {
                    const meta = {
                        logger: console,
                        device: defs.device,
                        message: { },
                        mapped: defs.definition,
                        options: {},
                        state: {} as Record<string, any>,
                        endpoint_name: defs.exposesMap[propId],
                    } as any;
                    for (const prop of props.values()) {
                        meta.state[prop.id] = prop.value;
                    }
                    meta.message.state = meta.state;

                    meta.message[propId] = value;
                    defs.device.endpoints.forEach(endpoint => {
                        converter.convertSet!(endpoint, propId, value, meta).then(result => {
                            if (!result) return;
                            if (result.state) {
                                for (const entry of Object.entries(result.state)) {
                                    const prop = props.get(entry[0]);
                                    if (prop && entry[1] !== undefined && entry[1] !== null) {
                                        prop.value = prop[1];
                                        this.engine.emit('gadgetPropertyEvent', entity, prop);
                                    }
                                }
                            }
                        }).catch((e) => { console.error(e); });
                    });
                }
            });
        } catch (e) {
            console.error(e);
        }
    }

    @tryCatchMethod
    readProperty (entity: Entity, propId: string) {
        const props = entity.get(PropertiesComponent);
        if (!props) return;
        const defs = entity.get(ZigbeeDeviceDefinition);
        if (!defs?.definition) return;
        defs.definition.toZigbee?.forEach(converter => {
            if (!converter.key?.includes(propId)) {
                return;
            }
            if (converter.convertGet) {
                const meta = {
                    logger: console,
                    device: defs.device,
                    message: { state: {} },
                    mapped: defs.definition,
                    options: {},
                    state: {},
                } as any;
                converter.convertGet(defs.device.endpoints[0], propId, meta).catch(e => { console.error(e); });
            }
        });
    }

    @tryCatchMethod
    async invokeAction (entity: Entity, actionId: string, ...args: any[]) {
        if (!entity.has(ZigbeeDeviceDefinition)) return;
        const definition = entity.get(ZigbeeDeviceDefinition)!;
        if (actionId === 'remove-from-host') {
            console.info('remove zigbee device from network ' + definition.device.ieeeAddr);
            await definition.controller.backup();
            definition.device.removeFromDatabase();
            try {
                await definition.device.removeFromNetwork();
            } catch {
                console.error(`can't remove the device ${definition.device.ieeeAddr} from the network`);
            }

            this.engine.emit('gadgetActonResult', entity, 'remove-from-host', []);
            this.engine.removeEntity(entity);
        }
    }

    async addCoordinatorsFromConfig () {
        const save = await this.saveController.readConfig();
        for (const s of save) {
            const options = {
                ...s,
            };
            try {
                const controller = new Controller(options as any);
                const controllerEntity = createZigbeeController(controller, s.serialPort.path);
                const controllerProperties = controllerEntity.get(PropertiesComponent)!;
                // @ts-expect-error bad types in zhm
                controller.on('deviceInterview', (data: { status: 'started' | 'successful' | 'failed'; device: Device; }) => {
                    if (data.status === 'successful') {
                        this.engine.nextUpdate(() => {
                            this.engine.nextUpdate(() => {
                                const creation = createZigbeeGadget(data.device, controller, false);
                                const oldEntity = this.engine.getEntityByName(creation.gadget.name);
                                if (oldEntity) {
                                    this.engine.removeEntity(oldEntity);
                                }
                                try {
                                    this.engine.addEntity(creation.gadget);
                                } catch (e) {
                                    console.error(e);
                                }
                            });
                        });
                    }
                });
                // @ts-expect-error bad types in zhm
                controller.on('message', (data) => {
                    this.onMessage(data, controller);
                });
                // @ts-expect-error bad types in zhm
                controller.on('permitJoinChanged', (data: IZhmPermitJoinChangedPayload) => {
                    controllerProperties.get('join:permit-time')!.value = data.timeout;
                    controllerProperties.get('join:permit')!.value = data.permitted;

                    this.engine.emit('gadgetPropertyEvent', controllerEntity, controllerProperties.get('join:permit-time')!);
                    this.engine.emit('gadgetPropertyEvent', controllerEntity, controllerProperties.get('join:permit')!);
                });

                controller.start().catch((e) => {
                    console.error(e);
                }).then(() => {
                    try {
                        // controller.permitJoin(true, undefined, 600);
                        this.engine.addEntity(controllerEntity);
                        controller.getDevices().forEach(d => {
                            const creation = createZigbeeGadget(d, controller, false);
                            this.engine.addEntity(creation.gadget);
                            creation.promise.then(() => {
                                const props = creation.gadget.get(PropertiesComponent);
                                // const defs = creation.gadget.get(ZigbeeDeviceDefinition);
                                for (const prop of props!.values()) {
                                    this.readProperty(creation.gadget, prop.id);
                                }
                            });
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

    @tryCatchMethod
    async onMessage (data: {
        type: 'raw' | 'readResponse' | 'attributeReport' | 'read';
        device: Device;
        endpoint: Endpoint;
        data: Buffer | Record<string, any>;
        linkquality: number;
        groupId: number;
        cluster: string;
        meta: any;
    }, controller: Controller) {
        // @ts-expect-error zhm code =)
        const database = controller.database;
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
        const fromZigbee = defs.definition?.fromZigbee;
        if (!fromZigbee) {
            console.error('no from zigbee for device ' + defs.device.modelID);
            return;
        }
        const meta = this.generateZhmMeta(data.device);
        for (const rule of fromZigbee) {
            if (rule.cluster === data.cluster && (rule.type === data.type || rule.type.includes(data.type))) {
                const result = await rule.convert(
                    defs.definition,
                    data as any,
                    (data) => { console.debug('zigbee publish', data); },
                    (Object.values(database.entries)).filter((d: any) => d.ieeeAddr === data.device.ieeeAddr)[0] || {} as any,
                    meta as any,

                ) || {};
                for (const key in result) {
                    if (props.has(key)) {
                        const prop = props.get(key)!;
                        prop.value = result[key];
                        this.engine.emit('gadgetPropertyEvent', entity, prop);
                    }
                }
            }
        }
        if (props.get('linkquality')) {
            const linkProp = props.get('linkquality')!;
            linkProp.value = data.linkquality;
            this.engine.emit('gadgetPropertyEvent', entity, linkProp);
        }
        if (data.type === 'attributeReport') {
            switch (data.cluster) {
                    case 'genPowerCfg':
                        for (const attribute of Object.entries(data.data)) {
                            if (props.get(attribute[0])) {
                                props.get(attribute[0])!.value = attribute[1];
                            }
                        }
            }
        }
    }

    private generateZhmMeta (device: Device) {
        return {
            device,
            logger: console,
            state: {}, // todo: state
            deviceExposesChanged: () => { },
        };
    }
}
