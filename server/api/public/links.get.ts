import { db } from '../../utils/db';export default defineEventHandler(async()=>db.link.findMany({where:{visible:true},orderBy:[{group:'asc'},{position:'asc'}]}))
