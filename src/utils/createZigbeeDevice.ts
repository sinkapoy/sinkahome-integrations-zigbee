import type { Entity } from "@ash.ts/ash";
import { IProperty, PropertiesComponent, PropertyAccessMode, PropertyDataType, createGadget } from "@sinkapoy/home-core";
import { basename } from "path";
import type { Controller } from "zigbee-herdsman";
import type { Device } from "zigbee-herdsman/dist/controller/model";
import { ZigbeeDeviceDefinition } from "../ecs/components/ZigbeeDevice";
import { Definition, Expose } from "zigbee-herdsman-converters";

function convertZhmAccessMode(mode: number) {
    switch (mode) {
        case 1:
            return PropertyAccessMode.rn;
        default:
            return PropertyAccessMode.none;
    }
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
            }
            props?.createPropertyFromJson(json);
            console.log(expo)
        }
    }

    if(defs?.definition?.endpoint){
        console.log("==============")
        console.log(defs?.definition?.endpoint(defs.device));
    } else {
        console.log("=============")
        console.log("no endpoints")
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