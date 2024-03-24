import type { Entity } from "@ash.ts/ash";
import { ActionsComponent, IProperty, PropertiesComponent, PropertyAccessMode, PropertyDataType, createGadget } from "@sinkapoy/home-core";
import { basename } from "path";
import type { Controller } from "zigbee-herdsman";
import type { Device } from "zigbee-herdsman/dist/controller/model";
import { ZigbeeDeviceDefinition } from "../ecs/components/ZigbeeDevice";
import { Definition, Expose } from "zigbee-herdsman-converters";
import { access } from "zigbee-herdsman-converters/lib/exposes";

function convertZhmAccessMode(mode: number) {
    let ourAccessMode: PropertyAccessMode = 0;
    if (mode & access.STATE || mode & access.GET) {
        ourAccessMode |= PropertyAccessMode.rn;
    }
    if (mode & access.SET) {
        ourAccessMode |= PropertyAccessMode.write;
    }
    return ourAccessMode;
}

function convertZhmDataType(type: string) {
    switch (type) {
        case 'numeric':
            return PropertyDataType.float;
        case 'enum':
            return PropertyDataType.string;
        default:
            return PropertyDataType.any;
    }
}

function convertConverterDefinitionToECS(entity: Entity, definition: Definition, device: Device) {
    // zhm-converter has poor types for "exposings" so here's a lot of <any>
    // to not to copy zhm-converter interfaces itself

    const props = entity.get(PropertiesComponent);
    const defs = entity.get(ZigbeeDeviceDefinition);
    if (defs?.exposes) {
        const exposes = defs.exposes;
        for (const expo of exposes) {
            const json: IProperty = {
                id: expo.name,
                accessMode: convertZhmAccessMode(expo.access || 0),
                description: expo.description,
                dataType: convertZhmDataType(expo.type),
                value: 0,
                units: (expo as any).unit
            }
            switch (expo.type) {
                case 'enum': {
                    json.enumData = {};
                    const values = ((expo as any).values as (string | number)[]);
                    if (values?.length) {
                        json.value = values[0];
                        for (const value of values) {
                            json.enumData[value + ''] = value;
                        }
                    }
                }
                    break;
                case 'numeric': {
                    const presets = (expo as any).presets as { name: string; value: number | string; description: string }[] | undefined;
                    if (presets?.length) {
                        json.enumData = {};
                        json.value = presets[0].value;
                        for (const preset of presets) {
                            json.enumData[preset.name] = preset.value;
                        }
                    }
                }
                    break;
            }
            props?.createPropertyFromJson(json);
        }
    }
}

export function createZigbeeGadget(device: Device, controller: Controller, configure = false): Entity {
    const gadget = createGadget(getUuidByZigbeeDevice(device), true);
    const props = gadget.get(PropertiesComponent)!;
    gadget.add(device);


    props.createPropertyFromJson({
        id: 'model-id',
        accessMode: PropertyAccessMode.read,
        dataType: PropertyDataType.string,
        value: device.modelID
    });

    const defininition = new ZigbeeDeviceDefinition(device, controller);

    defininition.getDefinition(configure).then(() => {
        gadget.add(defininition);
        if (defininition.definition) {
            convertConverterDefinitionToECS(gadget, defininition.definition, defininition.device);
        }
        defininition.restoreAttributes();

    });

    return gadget;
}

export function createZigbeeController(c: Controller, path: string) {
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
        accessMode: PropertyAccessMode.rwn
    });

    gadget.add(c);
    return gadget;
}

export function getUuidByZigbeeDevice(d: Device) {
    return 'zigbee:' + d.ieeeAddr;
}