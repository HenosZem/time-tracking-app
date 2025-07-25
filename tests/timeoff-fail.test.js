import { jest } from '@jest/globals';

async function submitTimeOff(supabase, userId, startDate, endDate, reason) {
  // Basic validation
  if (new Date(endDate) < new Date(startDate)) {
    return { error: "End date must be after start date." };
  }
  if (new Date(startDate) < new Date()) {
    return { error: "Start date must be in the future." };
  }

  return await supabase.from('time_off_requests').insert([{
    user_id: userId,
    start_date: startDate,
    end_date: endDate,
    reason: reason,
    status: 'pending'
  }]);
}

test('Blocks insert if start date is after end date', async () => {
  // Arrange
  const mockInsert = jest.fn();
  const supabase = {
    from: jest.fn(() => ({
      insert: mockInsert
    }))
  };

  const userId = 'fake-user';
  const startDate = '2025-07-10';
  const endDate = '2025-07-05';
  const reason = 'Invalid request test';

  // Act
  const result = await submitTimeOff(supabase, userId, startDate, endDate, reason);

  // Assert
  expect(mockInsert).not.toHaveBeenCalled();
  expect(result.error).toBe("End date must be after start date.");
});

test('Blocks insert if start date is in the past', async () => {
  const mockInsert = jest.fn();
  const supabase = {
    from: jest.fn(() => ({
      insert: mockInsert
    }))
  };

  const userId = 'fake-user';
  const startDate = '2023-01-01';
  const endDate = '2025-07-05';
  const reason = 'Past start date test';

  const result = await submitTimeOff(supabase, userId, startDate, endDate, reason);

  expect(mockInsert).not.toHaveBeenCalled();
  expect(result.error).toBe("Start date must be in the future.");
});
