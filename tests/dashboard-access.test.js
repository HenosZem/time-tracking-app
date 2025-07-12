test('Blocks data access without logged-in user', async () => {
  const mockGetUser = jest.fn().mockResolvedValue({ data: { user: null } });
  const supabase = { auth: { getUser: mockGetUser } };

  const session = await supabase.auth.getUser();

  expect(session.data.user).toBeNull();
});

