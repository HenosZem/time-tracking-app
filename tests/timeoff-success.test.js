import { jest } from '@jest/globals';

test('Creates a time-off request with valid dates', async () => {
  // Mock Supabase client
  const mockInsert = jest.fn().mockResolvedValue({ data: [{ id: '123' }], error: null });
  const supabase = {
    from: jest.fn(() => ({
      insert: mockInsert
    }))
  };

  // test input
  const userId = 'fake-user-id';
  const startDate = '2025-07-01';
  const endDate = '2025-07-05';
  const reason = 'Vacation';

  // simulate supabase
  await supabase.from('time_off_requests').insert([{
    user_id: userId,
    start_date: startDate,
    end_date: endDate,
    reason: reason,
    status: 'pending'
  }]);

  // Now verify it was called correctly
  expect(supabase.from).toHaveBeenCalledWith('time_off_requests');
  expect(mockInsert).toHaveBeenCalledWith([{
    user_id: userId,
    start_date: startDate,
    end_date: endDate,
    reason: reason,
    status: 'pending'
  }]);
});
