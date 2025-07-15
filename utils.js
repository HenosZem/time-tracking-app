export async function getCurrentUserId() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      console.error("User not authenticated:", error);
      return null;
    }
    return data.user.id;
  }
  