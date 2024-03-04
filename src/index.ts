import { homeEngine } from '@sinkapoy/home-core';
import { ZigbeeSystem } from './ecs/systems/ZigbeeSystem';

homeEngine.addSystem(new ZigbeeSystem(), 1);

// const SERIAL = '/dev/serial/by-id/usb-ITead_Sonoff_Zigbee_3.0_USB_Dongle_Plus_926451c9b69ded1192aedca5a7669f5d-if00-port0';
// //             '/dev/serial/by-id/usb-ITead_Sonoff_Zigbee_3.0_USB_Dongle_Plus_926451c9b69ded1192aedca5a7669f5d-if00-port0'
// const DB = './server-data/zigbee-devices.json'
// function generateExtPanID(): number[] {
//     const array: number[] = [];
//     array[7] = 0;

//     const key = array.map(() => ((Math.random() * 256) >> 0));
//     return key;
// }

// const logger = {
//     debug: console.log.bind(console),
//     log: console.log.bind(console),
//     error: console.log.bind(console),
//     warn: console.log.bind(console),
//     info: console.log.bind(console),
// }

// const coordinator = new Controller({
//     network: {
//         panID: 0xF0F0,
//         extendedPanID: generateExtPanID(),
//         channelList: [11, 15, 25],
//         networkKey: [1, 3, 5, 7, 6, 11, 13, 15, 0, 2, 4, 6, 8, 10, 12, 13]
//     },
//     serialPort: {
//         path: SERIAL,
//         // adapter: 'ezsp',
//         baudrate: 115200
//     },
//     databasePath: DB,
//     acceptJoiningDeviceHandler: () => true,
// } as any, logger);


// // coordinator.on('message', (data) => {
// //     console.log('message', data);
// // });
// coordinator.on('deviceJoined', (data: { device: Device }) => {
//     console.log('onDeviceJoined', data);

// });
// // coordinator.on('permitJoinChanged', (data) => {
// //     console.log('on permitJoinChanged', data);

// // });
// coordinator.on('deviceAnnounce', (data: { device: Device }) => {
//     console.log('on deviceAnnounce', data);
// });
// coordinator.on('deviceInterview', (data: { status: 'started' | 'successful', device: Device }) => {
//     console.log('on deviceInterview', data);
// });


// coordinator
//     .start()
//     .then(async (startResult) => {
//         console.log(startResult)
//         console.log('started with device', SERIAL);
//         console.log(coordinator.getNetworkParameters());
//         coordinator.permitJoin(true, undefined, 600);
//         // setInterval(()=>{
//         //     console.log(coordinator.getDevices());
//         // }, 500)
//         // coordinator.on('message', msg=>{
//         //     console.log("msg", msg);
//         // })
//         // setTimeout(()=>{
//         //     coordinator.getDevices().forEach(device=>{
//         //         device.on('message', (msg)=>{
//         //             console.log("device msg", device.manufacturerID, msg);
//         //         })
//         //     })
//         // }, 2000)
//     });
