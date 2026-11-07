'use server'; import { revalidatePath } from 'next/cache'; import { createClient } from '@/lib/supabase/server';
export async function markRead(formData: FormData){const id=String(formData.get('notification_id')??'');if(!id)return;const s=await createClient();await s.from('app_notifications').update({read_at:new Date().toISOString()}).eq('id',id);revalidatePath('/notifications');}
