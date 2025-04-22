import { getDatabase, ref, set, get, onValue, update, push } from 'firebase/database';
import { rtdb } from './firebase';

export { rtdb as db, ref, set, get, onValue, update, push };