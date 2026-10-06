import {
  getMessaging,
  onMessage,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import AlgorithmX from '../lib/index.js';
import { connectFirebaseMessaging, handleFirebaseMessage } from '../firebase.js';

const messaging = getMessaging();
const connection = connectFirebaseMessaging({ messaging });
await connection.ready;

onMessage(messaging, async (message) => {
  await AlgorithmX.handleRemoteMessage(message);
});
setBackgroundMessageHandler(messaging, async (message) => {
  await handleFirebaseMessage(message);
});

await AlgorithmX.init();
await AlgorithmX.init('https://api.example.com', 'partner');
// @ts-expect-error Both values are required when passing explicit configuration.
await AlgorithmX.init('https://api.example.com');
connection.remove();
