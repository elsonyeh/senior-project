import { getDatabase, ref, set, get, onValue, update, push } from 'firebase/database';
import { rtdb } from './legacy-firebase';

export { rtdb as db, ref, set, get, onValue, update, push };