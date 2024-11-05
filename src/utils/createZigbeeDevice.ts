import type { Entity } from '@ash.ts/ash';
import { ActionsComponent, type IProperty, PropertiesComponent, PropertyAccessMode, PropertyDataType, createGadget } from '@sinkapoy/home-core';
import { basename } from 'path';
import { type Controller } from 'zigbee-herdsman';
import type { Device } from 'zigbee-herdsman/dist/controller/model';
import { ZigbeeDeviceDefinition } from '../ecs/components/ZigbeeDevice';
import { type Definition } from 'zigbee-herdsman-converters';
import { type Base, type Binary, type Enum, access } from 'zigbee-herdsman-converters/lib/exposes';

function convertZhmAccessMode (mode: number) {
    let ourAccessMode: PropertyAccessMode = 0;
    if (mode & access.STATE || mode & access.GET) {
        ourAccessMode |= PropertyAccessMode.rn;
    }
    if (mode & access.SET) {
        ourAccessMode |= PropertyAccessMode.write;
    }
    return ourAccessMode;
}

function convertZhmDataType (type: string) {
    switch (type) {
            case 'numeric':
                return PropertyDataType.float;
            case 'enum':
                return PropertyDataType.any;
            default:
                return PropertyDataType.any;
    }
}

function createProp (props: PropertiesComponent, expo: Base & Binary & Enum, defs: ZigbeeDeviceDefinition) {
    const json: IProperty = {
        id: expo.property,
        accessMode: convertZhmAccessMode(expo.access || 0),
        description: expo.description,
        dataType: convertZhmDataType(expo.type),
        value: 0,
        units: (expo as any).unit,
    };
    if (!json.id) return;
    if (defs.databaseEntry?.homeProps) {
        if (defs.databaseEntry.homeProps[json.id] !== undefined) {
            json.value = defs.databaseEntry?.homeProps[json.id];
        }
    }
    switch (expo.type) {
            case 'enum': {
                json.enumData = {};
                const values = (expo.values);
                if (values?.length) {
                    json.value = values[0];
                    for (const value of values) {
                        json.enumData[value + ''] = value;
                    }
                }
                json.dataType = PropertyDataType.any;
            }
                break;
            case 'numeric': {
                const presets = (expo as any).presets as { name: string; value: number | string; description: string; }[] | undefined;
                if (presets?.length) {
                    json.enumData = {};
                    json.value = presets[0].value;
                    for (const preset of presets) {
                        json.enumData[preset.name] = preset.value;
                    }
                }
            }
                break;
            case 'binary':
                if (typeof expo.value_on === 'string') {
                    json.dataType = PropertyDataType.string;
                    json.enumData = {};
                    json.enumData[expo.value_off as string] = expo.value_off;
                    json.enumData[expo.value_on] = expo.value_on;
                    if (expo.value_toggle) { json.enumData[expo.value_toggle] = expo.value_toggle; }
                } else {
                    json.dataType = PropertyDataType.boolean;
                }
                break;
    }
    props.createPropertyFromJson(json);
}

function convertConverterDefinitionToECS (entity: Entity, definition: Definition, device: Device) {
    // zhm-converter has poor types for "exposings" so here's a lot of <any>
    // to not to copy zhm-converter interfaces itself
    try {
        const props = entity.get(PropertiesComponent)!;
        const defs = entity.get(ZigbeeDeviceDefinition);
        console.log(entity.name);
        if (defs?.exposes) {
            const exposes = defs.exposes;
            for (const expo of exposes) {
                switch (true) {
                        case !!expo.name:
                            createProp(props, expo as any, defs);
                            break;
                        case !!expo.features?.length:
                            for (const feature of expo.features!) {
                                createProp(props, feature as any, defs);
                            }
                            break;
                        default:
                            console.error(`cant process property for ${device.ieeeAddr}`, expo);
                }
            }
        }
        if (defs?.definition?.options) {
            for (const expo of defs.definition.options) {
                createProp(props, expo as any, defs);
            }
        }

        props.createPropertyFromJson({
            id: 'model',
            accessMode: PropertyAccessMode.read,
            value: definition.model,
        });
        props.createPropertyFromJson({
            id: 'vendor',
            accessMode: PropertyAccessMode.read,
            value: definition.vendor,
        });
        props.createPropertyFromJson({
            id: 'description',
            accessMode: PropertyAccessMode.read,
            value: definition.description,
        });
    } catch (e) {
        console.error(e);
    }
}

export function createZigbeeGadget (device: Device, controller: Controller, configure = false) {
    const gadget = createGadget(getUuidByZigbeeDevice(device), true);
    const props = gadget.get(PropertiesComponent)!;
    const actions = gadget.get(ActionsComponent)!;
    gadget.add(device);

    props.createPropertyFromJson({
        id: 'model-id',
        accessMode: PropertyAccessMode.read,
        dataType: PropertyDataType.string,
        value: device.modelID || '',
    });

    const defininition = new ZigbeeDeviceDefinition(device, controller);

    const promise = defininition.getDefinition(configure).then(() => {
        gadget.add(defininition);
        if (defininition.definition) {
            convertConverterDefinitionToECS(gadget, defininition.definition, defininition.device);
        }

        if (device.powerSource === 'Battery') {
            props.createPropertyFromJson({
                id: 'batteryVoltage',
                accessMode: PropertyAccessMode.rn,
                value: 0,
            });
            props.createPropertyFromJson({
                id: 'batteryPercentageRemaining',
                accessMode: PropertyAccessMode.rn,
                value: 0,
            });
        }
        defininition.restoreAttributes();
    });

    actions.addFromJson({
        id: 'remove-from-host',
        argsT: [],
        resultT: [],
        description: 'removes device from the smart home',
    });

    return { gadget, promise };
}

export function createZigbeeController (c: Controller, path: string) {
    const gadget = createGadget(basename(path), true);
    const properties = gadget.get(PropertiesComponent)!;
    properties.createPropertyFromJson({
        id: 'join:permit',
        dataType: PropertyDataType.boolean,
        value: false,
        accessMode: PropertyAccessMode.rwn,
    });
    properties.createPropertyFromJson({
        id: 'join:permit-time',
        dataType: PropertyDataType.int,
        value: 0,
        accessMode: PropertyAccessMode.rwn,
    });

    gadget.add(c);
    return gadget;
}

export function getUuidByZigbeeDevice (d: Device) {
    return 'zigbee:' + d.ieeeAddr;
}
