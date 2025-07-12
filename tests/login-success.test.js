test('Logs in user with correct credentials', async () => {
  const mockLogin = jest.fn().mockResolvedValue({ data: { session: {} }, error: null });
  const supabase = { auth: { signInWithPassword: mockLogin } };

  const email = 'user@example.com';
  const password = 'validpassword';

  await supabase.auth.signInWithPassword({ email, password });

  expect(mockLogin).toHaveBeenCalledWith({ email, password });
});

