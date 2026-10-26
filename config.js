/* Supabase settings — fill these in (see README.md).
   The anon key is safe to expose: Row Level Security in supabase/schema.sql
   makes the data read-only for everyone except ADMIN_EMAIL. */
window.CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR-ANON-KEY',
  ADMIN_EMAIL: 'you@example.com', // the Google/GitHub account email allowed to edit
  // current song in my season — change these anytime
  SONG: {
    title: 'Surges',
    artist: 'Orangestar',
    note: 'This is just an extra chapter before growing up',
    url: 'https://youtu.be/gfyDsmEkF_4?si=g6HWjVEDkUZSWNtJ', // paste your youtube link — it gets embedded on the song page
    lyrics: `Between the sky and the days that pass
Even if today has no shape, we’ll keep moving forward
In a fresh morning and a gentle breeze
As we breathe in, what is it our voices want?
I’ve lost my way, I can’t reach you
Even though words are always so simple
We still can’t reach the future we aim for
But for us, these feelings are everything

I know it, we can’t give up
Deep inside, our hearts are still burning
Don’t say we can’t do anything
This is just an extra chapter before growing up
Beyond the sky, as we take our first steps
Our everyday life keeps moving on
Until we go beyond the future we seek
Let’s aim for the best, for us who can’t be stopped

I can’t reach you
Even though words are always so simple
We still can’t reach the future we aim for
But our feelings will always keep burning
Until the future we reach becomes the past
Our spirit will never be stopped
"The light we couldn’t grasp even after trying
Is what’s best for us" let’s sing that

Between the sky and the days that pass
Even if today has no shape, we’ll keep moving forward
Within a drifting, directionless breeze
Through tears, what is it our voices want?
I’ve lost my way, I can’t reach you
(No one can truly know)
Even though words are always so simple
(The feelings we hope will reach the future)
You, who don’t know anything yet
Will keep aiming toward the future ahead

I know it, no one can know for sure
Deep inside, our hearts are still burning
Keep moving forward, even if the future we want isn’t there
We can still seize what’s best
Let’s burn up all the feelings words can’t express
"The light we couldn’t grasp even after trying
Is what’s best for us" say it out loud
I’ll aim for it, no one can know
We’ll surely go beyond the sunrise
Let’s break through the sky, beyond the future
Let’s keep aiming for "the best" for us`,
    lyricsCredit: { name: 'kazelyrics', url: 'https://www.kazelyrics.com/2021/08/lirikterjemahan-orangestar-feat-kase.html' }
  }
};
