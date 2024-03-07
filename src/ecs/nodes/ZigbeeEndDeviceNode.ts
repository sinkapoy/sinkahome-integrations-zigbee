import {defineNode} from "@ash.ts/ash";
import { ActionsComponent, PropertiesComponent } from "@sinkapoy/home-core";
import { ZigbeeDeviceDefinition } from "../components/ZigbeeDevice";

export class ZigbeeEndDeviceNode extends defineNode({
    properties: PropertiesComponent,
    actions: ActionsComponent,
    defs: ZigbeeDeviceDefinition,
}) {}