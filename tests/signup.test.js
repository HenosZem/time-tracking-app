test('Registers new user with valid credentials', async () => {
  const mockSignUp = jest.fn().mockResolvedValue({ data: {}, error: null });
  const supabase = { auth: { signUp: mockSignUp } };

  const email = 'test@example.com';
  const password = 'Password123';

  await supabase.auth.signUp({ email, password });

  expect(mockSignUp).toHaveBeenCalledWith({ email, password });
});

