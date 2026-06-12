import { NextResponse } from 'next/server';
export function GET(){return NextResponse.json({ok:true,service:'kuvo',timestamp:new Date().toISOString()})}
