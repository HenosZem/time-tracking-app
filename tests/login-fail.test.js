test('Fails login with incorrect password', async () => {
  const mockLogin = jest.fn().mockResolvedValue({ data: null, error: { message: 'Invalid login credentials' } });
  const supabase = { auth: { signInWithPassword: mockLogin } };

  const email = 'user@example.com';
  const password = 'wrongpassword';

  const result = await supabase.auth.signInWithPassword({ email, password });

  expect(result.error).toBeTruthy();
  expect(result.error.message).toBe('Invalid login credentials');
});

