import { EMPLOYEE_SEEDS } from '../seeds/employee.seed';
import type { Employee } from '@/domain/employee/schema';

class EmployeeRepository {
  private employees: Employee[] = [...EMPLOYEE_SEEDS];

  public getEmployees(): Employee[] {
    return this.employees;
  }

  public createEmployee(data: Omit<Employee, 'id'>): Employee {
    // 사번 중복 검증
    const duplicate = this.employees.some((e) => e.employeeNo === data.employeeNo);
    if (duplicate) {
      throw new Error(`이미 존재하는 사번(${data.employeeNo})입니다.`);
    }

    const newEmp: Employee = {
      id: `emp_${Date.now()}`,
      ...data
    };
    this.employees.push(newEmp);
    return newEmp;
  }

  public updateEmployee(id: string, data: Partial<Omit<Employee, 'id' | 'employeeNo'>>): Employee | null {
    const empIndex = this.employees.findIndex((e) => e.id === id);
    if (empIndex === -1) return null;

    const existing = this.employees[empIndex];
    const updated: Employee = {
      ...existing,
      ...data
    };

    this.employees[empIndex] = updated;
    return updated;
  }

  public deleteEmployee(id: string): boolean {
    // 인명관리 규정: 물리적으로 삭제하지 않고 퇴직(RETIRED) 처리로 상태 전환 관리
    return this.changeStatus(id, 'RETIRED');
  }

  public changeStatus(id: string, status: 'ACTIVE' | 'LEAVE' | 'RETIRED'): boolean {
    const emp = this.employees.find((e) => e.id === id);
    if (!emp) return false;
    emp.employmentStatus = status;
    return true;
  }
}

export const employeeRepo = new EmployeeRepository();
