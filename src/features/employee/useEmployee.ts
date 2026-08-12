import { useState, useCallback } from 'react';
import { employeeRepo } from '@/data/employee/employee.repo';
import type { Employee } from '@/domain/employee/schema';

export function useEmployee() {
  const [employees, setEmployees] = useState<Employee[]>(() => employeeRepo.getEmployees());

  const refresh = useCallback(() => {
    setEmployees([...employeeRepo.getEmployees()]);
  }, []);

  const createEmployee = useCallback((data: Omit<Employee, 'id'>) => {
    try {
      const newEmp = employeeRepo.createEmployee(data);
      refresh();
      return newEmp;
    } catch (error: any) {
      alert(error.message || '임직원 등록에 실패했습니다.');
      return null;
    }
  }, [refresh]);

  const updateEmployee = useCallback((id: string, data: Partial<Omit<Employee, 'id' | 'employeeNo'>>) => {
    const updated = employeeRepo.updateEmployee(id, data);
    refresh();
    return updated;
  }, [refresh]);

  const deleteEmployee = useCallback((id: string) => {
    const success = employeeRepo.deleteEmployee(id);
    refresh();
    return success;
  }, [refresh]);

  const changeStatus = useCallback((id: string, status: 'ACTIVE' | 'LEAVE' | 'RETIRED') => {
    const success = employeeRepo.changeStatus(id, status);
    refresh();
    return success;
  }, [refresh]);

  return {
    employees,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    changeStatus
  };
}
