import { db } from '../utils/db'
export default defineEventHandler(async(event)=>{try{await db.$queryRaw`SELECT 1`;return {status:'ok',database:'ok',time:new Date().toISOString()}}catch{setResponseStatus(event,503);return {status:'degraded',database:'unavailable',time:new Date().toISOString()}}})
