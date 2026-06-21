import { createClient } from "@supabase/supabase-js";

// Ensure environment variables are set
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase URL or Key is missing. Check your environment variables.");
}

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

export interface SupabaseChatMessage {
  id: string; // The message ID
  sender: "user" | "priya";
  text: string;
  sources?: { title: string; url: string; type?: "web" | "maps" }[];
  created_at?: string;
}

// Save a new message to Supabase
export async function saveMessageToSupabase(message: SupabaseChatMessage) {
  try {
    if (!supabase) return;
    
    // We assume a 'messages' table exists with columns: id, sender, text, sources, created_at
    const { error } = await supabase
      .from('messages')
      .insert([
        {
          id: message.id,
          sender: message.sender,
          text: message.text,
          sources: (message.sources && message.sources.length > 0) ? JSON.stringify(message.sources) : null,
          created_at: new Date().toISOString()
        }
      ]);
      
    if (error) {
      console.error("Error saving message to Supabase:", error);
    }
  } catch (error) {
    console.error("Failed to insert message:", error);
  }
}

// Fetch all messages sorted by created_at in ascending order
export async function fetchMessagesFromSupabase(): Promise<SupabaseChatMessage[]> {
  try {
    if (!supabase) return [];
    
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true });
      
    if (error) {
      console.error("Error fetching messages from Supabase:", error);
      return [];
    }
    
    // Parse sources back to array if it's a string, or just pass if object
    if (data) {
       return data.map((d: any) => {
         let parsedSources = undefined;
         if (d.sources) {
           try {
             parsedSources = typeof d.sources === 'string' ? JSON.parse(d.sources) : d.sources;
           } catch {
             parsedSources = undefined;
           }
         }
         return {
           id: d.id,
           sender: d.sender,
           text: d.text,
           sources: parsedSources,
           created_at: d.created_at
         } as SupabaseChatMessage;
       });
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch messages:", error);
    return [];
  }
}

// Clear all messages from Supabase
export async function clearMessagesFromSupabase() {
  try {
    if (!supabase) return;
    
    // Delete all records from the messages table
    const { error } = await supabase
      .from('messages')
      .delete()
      .neq('id', '0'); // Dummy condition to delete all rows
      
    if (error) {
      console.error("Error deleting messages in Supabase:", error);
    }
  } catch (error) {
    console.error("Failed to delete messages:", error);
  }
}
