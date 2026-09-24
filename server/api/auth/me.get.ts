import { requireAdmin } from '../../utils/security';export default defineEventHandler(async(event)=>{const a=await requireAdmin(event);return {id:a.id,username:a.username,email:a.email}})
