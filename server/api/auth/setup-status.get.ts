import { db } from '../../utils/db';export default defineEventHandler(async()=>({required:(await db.admin.count())===0}))
