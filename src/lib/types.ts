export type Subject={id:string;name:string;slug:string;icon:string;color:string};
export type Profile={id:string;full_name:string;email:string;grade:number;preferred_language:string;avatar_url?:string;xp:number;current_streak:number;longest_streak:number;last_activity_date?:string};
export type Conversation={id:string;user_id:string;title:string;subject_id?:string;created_at:string;updated_at:string};
export type Message={id:string;conversation_id:string;user_id:string;role:'user'|'assistant';content:string;image_url?:string;created_at:string};
export type Quiz={id:string;subject_id:string;topic_id?:string;difficulty:string;number_of_questions:number;score?:number;completed:boolean;created_at:string};
